import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';

describe('course comment routes', () => {
  let app: FastifyInstance;
  let courseId: string;
  let otherCourseId: string;
  let draftCourseId: string;
  let ids: Record<'s1' | 's2' | 'outsider' | 'admin' | 'instructor', string>;
  const tokens = {} as Record<keyof typeof ids, string>;

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  const list = (token = tokens.s1, id = courseId) =>
    app.inject({ method: 'GET', url: `/api/v1/courses/${id}/comments`, headers: auth(token) });
  const create = (payload: unknown, token = tokens.s1, id = courseId) =>
    app.inject({
      method: 'POST',
      url: `/api/v1/courses/${id}/comments`,
      headers: auth(token),
      payload: payload as Record<string, unknown>,
    });
  const remove = (commentId: string, token = tokens.s1, id = courseId) =>
    app.inject({ method: 'DELETE', url: `/api/v1/courses/${id}/comments/${commentId}`, headers: auth(token) });

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    await prisma.courseComment.deleteMany();
    await prisma.courseInstructor.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.module.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();

    const roles = {
      s1: 'STUDENT',
      s2: 'STUDENT',
      outsider: 'STUDENT',
      admin: 'ADMIN',
      instructor: 'INSTRUCTOR',
    } as const;
    ids = {} as typeof ids;
    for (const [key, role] of Object.entries(roles) as [keyof typeof ids, 'STUDENT' | 'ADMIN' | 'INSTRUCTOR'][]) {
      const user = await prisma.user.create({
        data: { email: `${key}@example.com`, passwordHash: 'x', name: key, role },
      });
      ids[key] = user.id;
      tokens[key] = signToken({ userId: user.id, role, roles: [role] });
    }

    const base = { description: 'Açıklama', category: 'Test', level: 'Başlangıç' };
    courseId = (await prisma.course.create({ data: { ...base, title: 'Kurs', status: 'PUBLISHED' } })).id;
    otherCourseId = (await prisma.course.create({ data: { ...base, title: 'Diğer', status: 'PUBLISHED' } })).id;
    draftCourseId = (await prisma.course.create({ data: { ...base, title: 'Taslak', status: 'DRAFT' } })).id;

    for (const key of ['s1', 's2'] as const) {
      await prisma.enrollment.create({ data: { userId: ids[key], courseId, method: 'OPEN' } });
    }
    await prisma.courseInstructor.create({ data: { courseId, userId: ids.instructor, position: 1 } });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('requires authentication', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/courses/${courseId}/comments` });
    expect(res.statusCode).toBe(401);
  });

  it('lists comments newest first with safe author and canDelete', async () => {
    await prisma.courseComment.create({
      data: { courseId, userId: ids.s1, body: 'eski', createdAt: new Date('2026-10-01T10:00:00Z') },
    });
    await prisma.courseComment.create({
      data: { courseId, userId: ids.s2, body: 'yeni', createdAt: new Date('2026-10-02T10:00:00Z') },
    });
    const res = await list(tokens.s1);
    expect(res.statusCode).toBe(200);
    const { comments } = res.json();
    expect(comments.map((c: { body: string }) => c.body)).toEqual(['yeni', 'eski']);
    expect(comments[0].canDelete).toBe(false);
    expect(comments[1].canDelete).toBe(true);
    expect(comments[0].author).toEqual({ id: ids.s2, name: 's2', avatarUrl: null });
    expect(comments[0].createdAt).toBe('2026-10-02T10:00:00.000Z');
    expect((await list(tokens.admin)).json().comments.every((c: { canDelete: boolean }) => c.canDelete)).toBe(true);
  });

  it('creates a trimmed comment', async () => {
    const res = await create({ body: '  Merhaba  ' });
    expect(res.statusCode).toBe(201);
    const { comment } = res.json();
    expect(comment.body).toBe('Merhaba');
    expect(comment.canDelete).toBe(true);
    expect(comment.author.id).toBe(ids.s1);
    expect(comment.author).not.toHaveProperty('email');
    expect(await prisma.courseComment.count()).toBe(1);
  });

  it('lets the course instructor and admin comment', async () => {
    expect((await create({ body: 'a' }, tokens.instructor)).statusCode).toBe(201);
    expect((await create({ body: 'b' }, tokens.admin)).statusCode).toBe(201);
  });

  it('rejects non-enrolled users with 403', async () => {
    const res = await create({ body: 'selam' }, tokens.outsider);
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('NOT_ENROLLED');
    expect(await prisma.courseComment.count()).toBe(0);
  });

  it('validates the body', async () => {
    for (const payload of [{ body: '' }, { body: '   ' }, { body: 'x'.repeat(1001) }, {}, { body: 5 }]) {
      const res = await create(payload);
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    }
    expect((await create({ body: 'x'.repeat(1000) })).statusCode).toBe(201);
  });

  it('lets the author delete', async () => {
    const c = await prisma.courseComment.create({ data: { courseId, userId: ids.s1, body: 'x' } });
    expect((await remove(c.id)).statusCode).toBe(204);
    expect(await prisma.courseComment.count()).toBe(0);
  });

  it('forbids another student from deleting', async () => {
    const c = await prisma.courseComment.create({ data: { courseId, userId: ids.s1, body: 'x' } });
    const res = await remove(c.id, tokens.s2);
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
    expect(await prisma.courseComment.count()).toBe(1);
  });

  it('lets an admin delete', async () => {
    const c = await prisma.courseComment.create({ data: { courseId, userId: ids.s1, body: 'x' } });
    expect((await remove(c.id, tokens.admin)).statusCode).toBe(204);
    expect(await prisma.courseComment.count()).toBe(0);
  });

  it('returns 404 for missing comment or comment of another course', async () => {
    const c = await prisma.courseComment.create({ data: { courseId, userId: ids.s1, body: 'x' } });
    const missing = await remove('nope');
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('COMMENT_NOT_FOUND');
    expect((await remove(c.id, tokens.s1, otherCourseId)).statusCode).toBe(404);
  });

  it('returns 404 for unknown or draft courses', async () => {
    const res = await list(tokens.s1, 'nope');
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('COURSE_NOT_FOUND');
    expect((await list(tokens.s1, draftCourseId)).statusCode).toBe(404);
    expect((await create({ body: 'x' }, tokens.s1, 'nope')).statusCode).toBe(404);
    expect((await list(tokens.admin, draftCourseId)).statusCode).toBe(200);
  });

  describe('owner replies', () => {
    const putReply = (commentId: string, payload: unknown, token = tokens.instructor, id = courseId) =>
      app.inject({
        method: 'PUT',
        url: `/api/v1/courses/${id}/comments/${commentId}/reply`,
        headers: auth(token),
        payload: payload as Record<string, unknown>,
      });
    const delReply = (commentId: string, token = tokens.instructor, id = courseId) =>
      app.inject({ method: 'DELETE', url: `/api/v1/courses/${id}/comments/${commentId}/reply`, headers: auth(token) });
    const mk = async () => (await prisma.courseComment.create({ data: { courseId, userId: ids.s1, body: 'soru' } })).id;

    it('lets the instructor reply and replace', async () => {
      const id = await mk();
      const res = await putReply(id, { body: '  Cevap  ' });
      expect(res.statusCode).toBe(200);
      const { comment } = res.json();
      expect(comment.reply.body).toBe('Cevap');
      expect(comment.reply.author).toEqual({ id: ids.instructor, name: 'instructor', avatarUrl: null });
      expect(typeof comment.reply.createdAt).toBe('string');
      expect(comment.canReply).toBe(true);
      expect(comment.canDeleteReply).toBe(true);
      const again = await putReply(id, { body: 'Yeni' });
      expect(again.json().comment.reply.body).toBe('Yeni');
    });

    it('lets an admin reply', async () => {
      const id = await mk();
      const res = await putReply(id, { body: 'Yönetici' }, tokens.admin);
      expect(res.statusCode).toBe(200);
      expect(res.json().comment.reply.author.id).toBe(ids.admin);
    });

    it('forbids students and other-course instructors', async () => {
      const id = await mk();
      const s = await putReply(id, { body: 'x' }, tokens.s2);
      expect(s.statusCode).toBe(403);
      expect(s.json().error.code).toBe('FORBIDDEN');
      await prisma.courseInstructor.create({ data: { courseId: otherCourseId, userId: ids.outsider, position: 1 } });
      await prisma.user.update({ where: { id: ids.outsider }, data: { role: 'INSTRUCTOR' } });
      const t = signToken({ userId: ids.outsider, role: 'INSTRUCTOR', roles: ['INSTRUCTOR'] });
      expect((await putReply(id, { body: 'x' }, t)).statusCode).toBe(403);
      expect((await delReply(id, tokens.s2)).statusCode).toBe(403);
    });

    it('validates reply body and comment existence', async () => {
      const id = await mk();
      for (const payload of [{ body: '' }, { body: '  ' }, { body: 'x'.repeat(1001) }, {}, { body: 3 }]) {
        const res = await putReply(id, payload);
        expect(res.statusCode).toBe(400);
        expect(res.json().error.code).toBe('VALIDATION_ERROR');
      }
      const missing = await putReply('nope', { body: 'x' });
      expect(missing.statusCode).toBe(404);
      expect(missing.json().error.code).toBe('COMMENT_NOT_FOUND');
      expect((await putReply(id, { body: 'x' }, tokens.admin, otherCourseId)).statusCode).toBe(404);
    });

    it('deletes a reply and 404s when none', async () => {
      const id = await mk();
      const none = await delReply(id);
      expect(none.statusCode).toBe(404);
      expect(none.json().error.code).toBe('REPLY_NOT_FOUND');
      await putReply(id, { body: 'x' });
      const res = await delReply(id);
      expect(res.statusCode).toBe(200);
      expect(res.json().comment.reply).toBeNull();
      expect(res.json().comment.canDeleteReply).toBe(false);
      const row = await prisma.courseComment.findUnique({ where: { id } });
      expect(row?.replyBody).toBeNull();
      expect(row?.replyAuthorId).toBeNull();
      expect(row?.repliedAt).toBeNull();
    });

    it('list includes reply and canReply flags per viewer', async () => {
      const id = await mk();
      await prisma.courseComment.create({ data: { courseId, userId: ids.s2, body: 'başka' } });
      await putReply(id, { body: 'Cevap' });
      const find = async (t: string) =>
        (await list(t)).json().comments.find((c: { id: string }) => c.id === id);
      const asStudent = await find(tokens.s1);
      expect(asStudent.reply.body).toBe('Cevap');
      expect(asStudent.canReply).toBe(false);
      expect(asStudent.canDeleteReply).toBe(false);
      const asInstructor = await find(tokens.instructor);
      expect(asInstructor.canReply).toBe(true);
      expect(asInstructor.canDeleteReply).toBe(true);
      const plain = (await list(tokens.instructor)).json().comments.find((c: { id: string }) => c.id !== id);
      expect(plain.reply).toBeNull();
      expect(plain.canReply).toBe(true);
      expect(plain.canDeleteReply).toBe(false);
    });
  });
});
