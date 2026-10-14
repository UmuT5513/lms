import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/rbac.js';
import { AppError } from '../errors.js';
import { canManageCourse } from '../lib/courseAccess.js';

const MAX_BODY_LENGTH = 1000;

const commentSelect = {
  id: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  user: { select: { id: true, name: true, avatarUrl: true } },
  replyBody: true,
  repliedAt: true,
  replyAuthor: { select: { id: true, name: true, avatarUrl: true } },
} as const;

interface CommentRow {
  id: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  user: { id: string; name: string; avatarUrl: string | null };
  replyBody: string | null;
  repliedAt: Date | null;
  replyAuthor: { id: string; name: string; avatarUrl: string | null } | null;
}

function toPublicComment(row: CommentRow, viewer: { userId: string; role: string }, canReply: boolean) {
  const reply =
    row.replyBody !== null
      ? {
          body: row.replyBody,
          createdAt: (row.repliedAt ?? row.updatedAt).toISOString(),
          author: row.replyAuthor ?? { id: '', name: 'Silinmiş kullanıcı', avatarUrl: null },
        }
      : null;
  return {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    author: { id: row.user.id, name: row.user.name, avatarUrl: row.user.avatarUrl },
    canDelete: row.userId === viewer.userId || viewer.role === 'ADMIN',
    reply,
    canReply,
    canDeleteReply: canReply && reply !== null,
  };
}

/** Kurs yoksa veya taslaksa (yönetici değilse) 404; taslağın varlığı sızdırılmaz. */
async function loadVisibleCourse(user: { userId: string; role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN' }, courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, status: true },
  });
  const canManage = course ? await canManageCourse(user, course.id) : false;
  if (!course || (course.status !== 'PUBLISHED' && !canManage)) {
    throw new AppError('COURSE_NOT_FOUND', 'Kurs bulunamadı.', 404);
  }
  return { course, canManage };
}

export function registerCourseCommentRoutes(app: FastifyInstance) {
  app.get<{ Params: { courseId: string } }>(
    '/api/v1/courses/:courseId/comments',
    { preHandler: [requireAuth] },
    async (request) => {
      const user = request.user!;
      const { course, canManage } = await loadVisibleCourse(user, request.params.courseId);
      const rows = await prisma.courseComment.findMany({
        where: { courseId: course.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: commentSelect,
      });
      return { comments: rows.map((row) => toPublicComment(row, user, canManage)) };
    },
  );

  app.post<{ Params: { courseId: string }; Body: { body?: unknown } | undefined }>(
    '/api/v1/courses/:courseId/comments',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;
      const { course, canManage } = await loadVisibleCourse(user, request.params.courseId);

      if (!canManage) {
        const enrollment = await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: user.userId, courseId: course.id } },
          select: { id: true },
        });
        if (!enrollment) {
          throw new AppError('NOT_ENROLLED', 'Yorum yapmak için kursa kayıtlı olmalısınız.', 403);
        }
      }

      const raw = request.body?.body;
      const body = typeof raw === 'string' ? raw.trim() : '';
      if (body.length < 1 || body.length > MAX_BODY_LENGTH) {
        throw new AppError(
          'VALIDATION_ERROR',
          `Yorum 1 ile ${MAX_BODY_LENGTH} karakter arasında olmalıdır.`,
          400,
        );
      }

      const created = await prisma.courseComment.create({
        data: { courseId: course.id, userId: user.userId, body },
        select: commentSelect,
      });
      reply.status(201);
      return { comment: toPublicComment(created, user, canManage) };
    },
  );

  app.delete<{ Params: { courseId: string; commentId: string } }>(
    '/api/v1/courses/:courseId/comments/:commentId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;
      const comment = await prisma.courseComment.findUnique({
        where: { id: request.params.commentId },
        select: { id: true, courseId: true, userId: true },
      });
      if (!comment || comment.courseId !== request.params.courseId) {
        throw new AppError('COMMENT_NOT_FOUND', 'Yorum bulunamadı.', 404);
      }
      if (comment.userId !== user.userId && user.role !== 'ADMIN') {
        throw new AppError('FORBIDDEN', 'Bu yorumu silme yetkiniz yok.', 403);
      }
      await prisma.courseComment.deleteMany({ where: { id: comment.id } });
      reply.status(204);
      return reply.send();
    },
  );

  type ReplyParams = { courseId: string; commentId: string };

  async function loadCommentForReply(
    user: { userId: string; role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN' },
    params: ReplyParams,
  ) {
    const { course, canManage } = await loadVisibleCourse(user, params.courseId);
    const comment = await prisma.courseComment.findUnique({
      where: { id: params.commentId },
      select: { id: true, courseId: true, replyBody: true },
    });
    if (!comment || comment.courseId !== course.id) {
      throw new AppError('COMMENT_NOT_FOUND', 'Yorum bulunamadı.', 404);
    }
    if (!canManage) {
      throw new AppError('FORBIDDEN', 'Bu yoruma yanıt verme yetkiniz yok.', 403);
    }
    return comment;
  }

  app.put<{ Params: ReplyParams; Body: { body?: unknown } | undefined }>(
    '/api/v1/courses/:courseId/comments/:commentId/reply',
    { preHandler: [requireAuth] },
    async (request) => {
      const user = request.user!;
      const comment = await loadCommentForReply(user, request.params);
      const raw = request.body?.body;
      const body = typeof raw === 'string' ? raw.trim() : '';
      if (body.length < 1 || body.length > MAX_BODY_LENGTH) {
        throw new AppError(
          'VALIDATION_ERROR',
          `Yanıt 1 ile ${MAX_BODY_LENGTH} karakter arasında olmalıdır.`,
          400,
        );
      }
      const updated = await prisma.courseComment.update({
        where: { id: comment.id },
        data: { replyBody: body, replyAuthorId: user.userId, repliedAt: new Date() },
        select: commentSelect,
      });
      return { comment: toPublicComment(updated, user, true) };
    },
  );

  app.delete<{ Params: ReplyParams }>(
    '/api/v1/courses/:courseId/comments/:commentId/reply',
    { preHandler: [requireAuth] },
    async (request) => {
      const user = request.user!;
      const comment = await loadCommentForReply(user, request.params);
      if (comment.replyBody === null) {
        throw new AppError('REPLY_NOT_FOUND', 'Yanıt bulunamadı.', 404);
      }
      const updated = await prisma.courseComment.update({
        where: { id: comment.id },
        data: { replyBody: null, replyAuthorId: null, repliedAt: null },
        select: commentSelect,
      });
      return { comment: toPublicComment(updated, user, true) };
    },
  );
}
