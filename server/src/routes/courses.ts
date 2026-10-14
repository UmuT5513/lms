import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole, tryAuth } from '../middleware/rbac.js';
import { AppError } from '../errors.js';
import { computeProgress } from '../lib/progress.js';
import {
  assertCanManageCourse,
  canManageCourse,
  instructorsInclude,
  toPublicInstructors,
  type InstructorRow,
} from '../lib/courseAccess.js';
import { resolveInstructorUsers } from './courseInstructors.js';

interface CreateCourseBody {
  title: string;
  description: string;
  category: string;
  level: string;
  tags: string[];
  accessMode: 'SEQUENTIAL' | 'FREE';
  priceKurus?: number;
  instructorIds?: string[];
}

interface ListCoursesQuery {
  category?: string;
  level?: string;
  tag?: string;
  q?: string;
}

function toPublicCourse(course: {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  tags: string;
  accessMode: string;
  status: string;
  priceKurus: number;
  instructors: InstructorRow[];
}) {
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    category: course.category,
    level: course.level,
    tags: course.tags ? course.tags.split(',') : [],
    accessMode: course.accessMode,
    status: course.status,
    priceKurus: course.priceKurus,
    instructors: toPublicInstructors(course.instructors),
  };
}

interface UpdateCourseBody {
  title?: string;
  description?: string;
  category?: string;
  level?: string;
  tags?: string[];
  accessMode?: 'SEQUENTIAL' | 'FREE';
  status?: 'DRAFT' | 'PUBLISHED';
  priceKurus?: number;
}

function assertValidPrice(priceKurus: unknown) {
  if (priceKurus !== undefined && (!Number.isInteger(priceKurus) || (priceKurus as number) < 0)) {
    throw new AppError('INVALID_PRICE', 'Fiyat sıfır veya pozitif bir tam sayı (kuruş) olmalıdır.', 400);
  }
}

export function registerCourseRoutes(app: FastifyInstance) {
  app.get<{ Querystring: ListCoursesQuery }>(
    '/api/v1/courses',
    { preHandler: [tryAuth] },
    async (request) => {
      const { category, level, tag, q } = request.query;
      const isAdmin = request.user?.role === 'ADMIN';
      const courses = await prisma.course.findMany({
        where: {
          ...(isAdmin ? {} : { status: 'PUBLISHED' }),
          ...(category ? { category } : {}),
          ...(level ? { level } : {}),
          ...(tag ? { tags: { contains: tag } } : {}),
          ...(q ? { title: { contains: q } } : {}),
        },
        include: { instructors: instructorsInclude },
      });
      return { courses: courses.map(toPublicCourse) };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/v1/courses/:id',
    { preHandler: [tryAuth] },
    async (request) => {
      const course = await prisma.course.findUnique({
        where: { id: request.params.id },
        include: {
          modules: { include: { lessons: true }, orderBy: { order: 'asc' } },
          instructors: instructorsInclude,
        },
      });
      if (!course) {
        throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
      }
      const isOwnerOrAdmin = await canManageCourse(request.user, course.id);
      if (course.status !== 'PUBLISHED' && !isOwnerOrAdmin) {
        throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
      }
      let isEnrolled = false;
      if (!isOwnerOrAdmin && request.user) {
        const enrollment = await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: request.user.userId, courseId: course.id } },
        });
        isEnrolled = Boolean(enrollment);
      }
      const canSeeContent = isOwnerOrAdmin || isEnrolled;
      const progress =
        isEnrolled && request.user ? await computeProgress(request.user.userId, course.id) : null;
      return {
        course: {
          ...toPublicCourse(course),
          isEnrolled,
          ...(progress ? { progress } : {}),
          modules: canSeeContent
            ? course.modules.map((module) => ({
                id: module.id,
                title: module.title,
                order: module.order,
                lessons: module.lessons
                  .filter((lesson) => isOwnerOrAdmin || lesson.status === 'PUBLISHED')
                  .sort((a, b) => a.order - b.order)
                  .map((lesson) => ({
                    id: lesson.id,
                    title: lesson.title,
                    description: lesson.description,
                    contentType: lesson.contentType,
                    contentUrl: lesson.contentUrl,
                    order: lesson.order,
                    status: lesson.status,
                  })),
              }))
            : [],
        },
      };
    },
  );

  app.post<{ Body: CreateCourseBody }>(
    '/api/v1/courses',
    { preHandler: [requireAuth, requireRole('INSTRUCTOR', 'ADMIN')] },
    async (request, reply) => {
      const { title, description, category, level, tags, accessMode, priceKurus, instructorIds } = request.body;
      assertValidPrice(priceKurus);
      let assigned: string[];
      if (request.user!.role === 'ADMIN') {
        const ids = [...new Set(instructorIds ?? [])];
        await resolveInstructorUsers(ids, 400);
        assigned = ids;
      } else {
        assigned = [request.user!.userId];
      }
      const course = await prisma.course.create({
        data: {
          title,
          description,
          category,
          level,
          tags: tags.join(','),
          accessMode,
          ...(priceKurus !== undefined ? { priceKurus } : {}),
          instructors: {
            create: assigned.map((userId, index) => ({ userId, position: index + 1 })),
          },
        },
        include: { instructors: instructorsInclude },
      });
      reply.status(201);
      return { course: toPublicCourse(course) };
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateCourseBody }>(
    '/api/v1/courses/:id',
    { preHandler: [requireAuth] },
    async (request) => {
      const course = await prisma.course.findUnique({ where: { id: request.params.id } });
      if (!course) {
        throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
      }
      await assertCanManageCourse(request.user, course.id);
      const { title, description, category, level, tags, accessMode, status, priceKurus } = request.body;
      assertValidPrice(priceKurus);
      const updated = await prisma.course.update({
        where: { id: course.id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(category !== undefined ? { category } : {}),
          ...(level !== undefined ? { level } : {}),
          ...(tags !== undefined ? { tags: tags.join(',') } : {}),
          ...(accessMode !== undefined ? { accessMode } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(priceKurus !== undefined ? { priceKurus } : {}),
        },
        include: { instructors: instructorsInclude },
      });
      return { course: toPublicCourse(updated) };
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/courses/:id',
    { preHandler: [requireAuth] },
    async (request) => {
      const course = await prisma.course.findUnique({ where: { id: request.params.id } });
      if (!course) {
        throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
      }
      await assertCanManageCourse(request.user, course.id);
      await prisma.course.delete({ where: { id: course.id } });
      return { success: true };
    },
  );

  app.get<{ Params: { courseId: string } }>(
    '/api/v1/courses/:courseId/students',
    { preHandler: [requireAuth] },
    async (request) => {
      const course = await prisma.course.findUnique({ where: { id: request.params.courseId } });
      if (!course) {
        throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
      }
      await assertCanManageCourse(request.user, course.id);
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId: course.id },
        include: { user: true },
        orderBy: { enrolledAt: 'asc' },
      });
      return {
        students: enrollments.map((enrollment) => ({
          id: enrollment.user.id,
          name: enrollment.user.name,
          email: enrollment.user.email,
          enrolledAt: enrollment.enrolledAt,
          method: enrollment.method,
        })),
      };
    },
  );

  app.delete<{ Params: { courseId: string; userId: string } }>(
    '/api/v1/courses/:courseId/students/:userId',
    { preHandler: [requireAuth] },
    async (request) => {
      const course = await prisma.course.findUnique({ where: { id: request.params.courseId } });
      if (!course) {
        throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
      }
      await assertCanManageCourse(request.user, course.id);
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: request.params.userId, courseId: course.id } },
      });
      if (!enrollment) {
        throw new AppError('ENROLLMENT_NOT_FOUND', 'Kayıt bulunamadı.', 404);
      }
      await prisma.enrollment.delete({ where: { id: enrollment.id } });
      return { success: true };
    },
  );
}
