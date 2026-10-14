import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { buildCallbackHash, getPaytrConfig, type PaytrClient } from '../lib/paytr.js';

const ENV = {
  PAYTR_MERCHANT_ID: '123456',
  PAYTR_MERCHANT_KEY: 'test-anahtar',
  PAYTR_MERCHANT_SALT: 'test-tuz',
  PAYTR_TEST_MODE: '1',
};

describe('PayTR ödeme akışı', () => {
  let app: FastifyInstance;
  const getIframeToken = vi.fn<PaytrClient['getIframeToken']>();
  let studentToken: string;
  let otherToken: string;
  let studentId: string;
  let paidCourseId: string;
  let freeCourseId: string;

  beforeAll(async () => {
    app = await buildApp({ paytrClient: { getIframeToken } });
  });

  beforeEach(async () => {
    Object.assign(process.env, ENV);
    getIframeToken.mockReset();
    getIframeToken.mockResolvedValue({ status: 'success', token: 'iframe-token-123' });

    await prisma.order.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.lessonProgress.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.module.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await bcrypt.hash('sifre123', 12);
    const student = await prisma.user.create({
      data: { email: 'ogrenci@example.com', passwordHash, name: 'Öğrenci' },
    });
    studentId = student.id;
    await prisma.user.create({ data: { email: 'diger@example.com', passwordHash, name: 'Diğer' } });
    const login = async (email: string) =>
      (await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'sifre123' } }))
        .json().token as string;
    studentToken = await login('ogrenci@example.com');
    otherToken = await login('diger@example.com');

    const base = { description: 'd', category: 'c', level: 'BEGINNER', status: 'PUBLISHED' };
    paidCourseId = (await prisma.course.create({ data: { ...base, title: 'Ücretli', priceKurus: 4999 } })).id;
    freeCourseId = (await prisma.course.create({ data: { ...base, title: 'Ücretsiz' } })).id;
  });

  afterEach(() => {
    for (const key of Object.keys(ENV)) delete process.env[key];
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const checkout = (courseId: string, token = studentToken) =>
    app.inject({
      method: 'POST',
      url: `/api/v1/courses/${courseId}/checkout`,
      headers: { authorization: `Bearer ${token}` },
    });

  function callback(fields: Record<string, string>, hashOverride?: string) {
    const cfg = getPaytrConfig()!;
    const hash = hashOverride ?? buildCallbackHash(cfg, {
      merchant_oid: fields.merchant_oid, status: fields.status, total_amount: fields.total_amount,
    });
    return app.inject({
      method: 'POST',
      url: '/api/v1/payments/paytr/callback',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({ ...fields, hash, test_mode: '1', payment_type: 'card' }).toString(),
    });
  }

  const enrollmentCount = () =>
    prisma.enrollment.count({ where: { userId: studentId, courseId: paidCourseId } });

  it('checkout bekleyen sipariş oluşturur ve PayTR\'a doğru tutarı yollar', async () => {
    const res = await checkout(paidCourseId);
    expect(res.statusCode).toBe(200);
    expect(res.json().iframeToken).toBe('iframe-token-123');

    const order = await prisma.order.findUniqueOrThrow({ where: { merchantOid: res.json().merchantOid } });
    expect(order).toMatchObject({ status: 'PENDING', amountKurus: 4999, userId: studentId, testMode: true });

    const [, req] = getIframeToken.mock.calls[0];
    expect(req).toMatchObject({ paymentAmount: 4999, email: 'ogrenci@example.com', merchantOid: order.merchantOid });
    expect(req.okUrl).toContain(`/odeme/sonuc?oid=${order.merchantOid}`);
  });

  it('ücretsiz kurs ve zaten kayıtlı kullanıcı için checkout reddedilir', async () => {
    expect((await checkout(freeCourseId)).json().error.code).toBe('COURSE_IS_FREE');
    await prisma.enrollment.create({ data: { userId: studentId, courseId: paidCourseId, method: 'ADMIN_ASSIGNED' } });
    const res = await checkout(paidCourseId);
    expect(res.statusCode).toBe(409);
    expect(getIframeToken).not.toHaveBeenCalled();
  });

  it('mağaza bilgileri yoksa 503 döner', async () => {
    delete process.env.PAYTR_MERCHANT_KEY;
    const res = await checkout(paidCourseId);
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('PAYMENT_NOT_CONFIGURED');
  });

  it('PayTR token vermezse 502 döner ve sipariş FAILED olur', async () => {
    getIframeToken.mockResolvedValue({ status: 'failed', reason: 'Zorunlu alan degeri gecersiz' });
    const res = await checkout(paidCourseId);
    expect(res.statusCode).toBe(502);
    expect(await prisma.order.findFirstOrThrow()).toMatchObject({ status: 'FAILED' });
  });

  it('ücretli kursa doğrudan kayıt 402 ile reddedilir', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/courses/${paidCourseId}/enroll`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: { method: 'OPEN' },
    });
    expect(res.statusCode).toBe(402);
    expect(res.json().error.code).toBe('PAYMENT_REQUIRED');
  });

  it('başarılı bildirim kaydı açar; tekrarlayan bildirim yalnızca OK döner', async () => {
    const oid = (await checkout(paidCourseId)).json().merchantOid;
    const fields = { merchant_oid: oid, status: 'success', total_amount: '4999' };

    const first = await callback(fields);
    expect(first.statusCode).toBe(200);
    expect(first.body).toBe('OK');
    expect(first.headers['content-type']).toContain('text/plain');
    expect(await enrollmentCount()).toBe(1);
    expect(await prisma.order.findUniqueOrThrow({ where: { merchantOid: oid } })).toMatchObject({
      status: 'PAID', totalAmountKurus: 4999, paymentType: 'card',
    });

    const again = await callback(fields);
    expect(again.body).toBe('OK');
    expect(await enrollmentCount()).toBe(1);
  });

  it('başarısız bildirim kayıt açmaz ve sebebi saklar', async () => {
    const oid = (await checkout(paidCourseId)).json().merchantOid;
    const res = await callback({
      merchant_oid: oid, status: 'failed', total_amount: '4999',
      failed_reason_code: '6', failed_reason_msg: 'Müşteri ödeme yapmaktan vazgeçti',
    });
    expect(res.body).toBe('OK');
    expect(await enrollmentCount()).toBe(0);
    expect(await prisma.order.findUniqueOrThrow({ where: { merchantOid: oid } })).toMatchObject({
      status: 'FAILED', failedReasonCode: '6',
    });
  });

  it('hatalı hash ile gelen bildirim reddedilir, kayıt açılmaz', async () => {
    const oid = (await checkout(paidCourseId)).json().merchantOid;
    const res = await callback({ merchant_oid: oid, status: 'success', total_amount: '4999' }, 'sahte-hash');
    expect(res.statusCode).toBe(400);
    expect(res.body).not.toBe('OK');
    expect(await enrollmentCount()).toBe(0);
    expect(await prisma.order.findUniqueOrThrow({ where: { merchantOid: oid } })).toMatchObject({ status: 'PENDING' });
  });

  it('sipariş durumu yalnızca sahibine gösterilir', async () => {
    const oid = (await checkout(paidCourseId)).json().merchantOid;
    const own = await app.inject({
      method: 'GET', url: `/api/v1/payments/${oid}`, headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(own.statusCode).toBe(200);
    expect(own.json().order).toMatchObject({ status: 'PENDING', courseId: paidCourseId, amountKurus: 4999 });

    const other = await app.inject({
      method: 'GET', url: `/api/v1/payments/${oid}`, headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(other.statusCode).toBe(404);
  });
});
