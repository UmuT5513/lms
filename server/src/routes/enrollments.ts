import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/rbac.js';
import { AppError } from '../errors.js';
import { toPercent } from '../lib/progress.js';
import { instructorsInclude, toPublicInstructors } from '../lib/courseAccess.js';

interface EnrollBody {
  method: 'OPEN' | 'INVITE_CODE' | 'ADMIN_ASSIGNED';
}

export function registerEnrollmentRoutes(app: FastifyInstance) {
  app.post<{ Params: { courseId: string }; Body: EnrollBody }>(
    '/api/v1/courses/:courseId/enroll',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const course = await prisma.course.findUnique({ where: { id: request.params.courseId } });
      if (!course || course.status !== 'PUBLISHED') {
        throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
      }
      if (course.priceKurus > 0) {
        throw new AppError('PAYMENT_REQUIRED', 'Bu kurs ücretlidir; kayıt ödeme ile açılır.', 402);
      }
      const existing = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: request.user!.userId, courseId: course.id } },
      });
      if (existing) {
        throw new AppError('ALREADY_ENROLLED', 'Bu kursa zaten kayıtlısınız.', 409);
      }
      const enrollment = await prisma.enrollment.create({
        data: { userId: request.user!.userId, courseId: course.id, method: request.body.method },
      });
      reply.status(201);
      return {
        enrollment: {
          id: enrollment.id,
          userId: enrollment.userId,
          courseId: enrollment.courseId,
          method: enrollment.method,
          enrolledAt: enrollment.enrolledAt,
        },
      };
    },
  );

  app.get(
    '/api/v1/users/me/courses',
    { preHandler: [requireAuth] },
    async (request) => {
      const enrollments = await prisma.enrollment.findMany({
        where: { userId: request.user!.userId },
        include: { course: { include: { instructors: instructorsInclude } } },
      });
      const userId = request.user!.userId;
      const courseIds = enrollments.map(({ course }) => course.id);
      // Batched: tek sorguda tüm kayıtlı kursların modülleri + yayınlanmış dersleri,
      // tek sorguda kullanıcının tamamladığı dersler (N+1 yok).
      const [modules, completedRows] = courseIds.length
        ? await Promise.all([
            prisma.module.findMany({
              where: { courseId: { in: courseIds } },
              orderBy: { order: 'asc' },
              select: {
                courseId: true,
                lessons: {
                  where: { status: 'PUBLISHED' },
                  orderBy: { order: 'asc' },
                  select: { id: true, title: true, contentType: true, contentUrl: true },
                },
              },
            }),
            prisma.lessonProgress.findMany({
              where: {
                userId,
                lesson: { status: 'PUBLISHED', module: { courseId: { in: courseIds } } },
              },
              select: { lessonId: true },
            }),
          ])
        : [[], []];
      const completedIds = new Set(completedRows.map((row) => row.lessonId));
      interface Stats {
        total: number;
        done: number;
        moduleCount: number;
        nextLesson: { id: string; title: string; contentType: string; contentUrl: string | null } | null;
      }
      const stats = new Map<string, Stats>();
      // modules zaten order asc geliyor; kurs bazında sırayla işlenir.
      for (const mod of modules) {
        const entry = stats.get(mod.courseId) ?? { total: 0, done: 0, moduleCount: 0, nextLesson: null };
        stats.set(mod.courseId, entry);
        if (mod.lessons.length > 0) entry.moduleCount += 1;
        for (const lesson of mod.lessons) {
          entry.total += 1;
          if (completedIds.has(lesson.id)) {
            entry.done += 1;
          } else if (!entry.nextLesson) {
            entry.nextLesson = {
              id: lesson.id,
              title: lesson.title,
              contentType: lesson.contentType,
              contentUrl: lesson.contentUrl,
            };
          }
        }
      }
      const items = enrollments.map(({ course }) => {
        const entry = stats.get(course.id);
        const totalLessons = entry?.total ?? 0;
        const completedCount = entry?.done ?? 0;
        return {
          id: course.id,
          title: course.title,
          category: course.category,
          level: course.level,
          accessMode: course.accessMode,
          progress: { percent: toPercent(completedCount, totalLessons), completedCount, totalLessons },
          nextLesson: entry?.nextLesson ?? null,
          moduleCount: entry?.moduleCount ?? 0,
          instructors: toPublicInstructors(course.instructors),
        };
      });
      // Sıralama: önce devam edenler (1..99, yüksekten düşüğe), sonra 0, en son 100; eşitlikte başlığa göre.
      const rank = (percent: number) => (percent >= 1 && percent <= 99 ? 0 : percent === 0 ? 1 : 2);
      items.sort((x, y) => {
        const rx = rank(x.progress.percent);
        const ry = rank(y.progress.percent);
        if (rx !== ry) return rx - ry;
        if (rx === 0 && x.progress.percent !== y.progress.percent) {
          return y.progress.percent - x.progress.percent;
        }
        return x.title.localeCompare(y.title, 'tr');
      });
      return { courses: items };
    },
  );
}
