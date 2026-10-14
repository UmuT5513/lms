import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import * as mailer from '../lib/mailer.js';

describe('şifre sıfırlama', () => {
  let app: FastifyInstance;
  let sentLink: string | null;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    sentLink = null;
    vi.spyOn(mailer, 'sendPasswordResetEmail').mockImplementation(async (_to, link) => {
      sentLink = link;
    });
    await prisma.passwordResetToken.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.lessonProgress.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.module.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.create({
      data: {
        email: 'unuttu@example.com',
        passwordHash: await bcrypt.hash('eskisifre1', 12),
        name: 'Unutkan',
      },
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const forgot = (email: string) =>
    app.inject({ method: 'POST', url: '/api/v1/auth/forgot-password', payload: { email } });
  const reset = (token: string, password: string) =>
    app.inject({ method: 'POST', url: '/api/v1/auth/reset-password', payload: { token, password } });
  const tokenFromLink = () => new URL(sentLink!).searchParams.get('token')!;

  it('bağlantı üretir, yeni şifreyle giriş yapılır, eski şifre geçmez', async () => {
    const res = await forgot('unuttu@example.com');
    expect(res.statusCode).toBe(200);
    expect(sentLink).toContain('/sifre-sifirla?token=');

    expect((await reset(tokenFromLink(), 'yenisifre1')).statusCode).toBe(200);

    const ok = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'unuttu@example.com', password: 'yenisifre1' },
    });
    expect(ok.statusCode).toBe(200);
    const old = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'unuttu@example.com', password: 'eskisifre1' },
    });
    expect(old.statusCode).toBe(401);
  });

  it('bilinmeyen e-postada aynı yanıtı verir ve bağlantı üretmez', async () => {
    const known = await forgot('unuttu@example.com');
    const unknown = await forgot('yok@example.com');
    expect(unknown.statusCode).toBe(200);
    expect(unknown.json()).toEqual(known.json());
    sentLink = null;
    await forgot('yok@example.com');
    expect(sentLink).toBeNull();
  });

  it('token ikinci kez kullanılamaz', async () => {
    await forgot('unuttu@example.com');
    const token = tokenFromLink();
    expect((await reset(token, 'yenisifre1')).statusCode).toBe(200);
    const again = await reset(token, 'baskasifre1');
    expect(again.statusCode).toBe(400);
    expect(again.json().error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('süresi dolmuş token reddedilir', async () => {
    await forgot('unuttu@example.com');
    const token = tokenFromLink();
    await prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await reset(token, 'yenisifre1');
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('rastgele token reddedilir, ham token veritabanında saklanmaz', async () => {
    await forgot('unuttu@example.com');
    const token = tokenFromLink();
    const stored = await prisma.passwordResetToken.findFirstOrThrow();
    expect(stored.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(stored.tokenHash).not.toBe(token);
    expect((await reset('x'.repeat(64), 'yenisifre1')).statusCode).toBe(400);
  });

  it('zayıf şifreyi reddeder ve token tüketilmez', async () => {
    await forgot('unuttu@example.com');
    const token = tokenFromLink();
    const weak = await reset(token, 'kisa');
    expect(weak.statusCode).toBe(400);
    expect(weak.json().error.code).toBe('WEAK_PASSWORD');
    expect((await reset(token, 'yenisifre1')).statusCode).toBe(200);
  });

  it('yeni istek önceki kullanılmamış token\'ı geçersiz kılar', async () => {
    await forgot('unuttu@example.com');
    const first = tokenFromLink();
    await forgot('unuttu@example.com');
    expect((await reset(first, 'yenisifre1')).statusCode).toBe(400);
    expect((await reset(tokenFromLink(), 'yenisifre1')).statusCode).toBe(200);
  });
});
