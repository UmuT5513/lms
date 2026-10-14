import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import { errorHandler } from './errors.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerCourseRoutes } from './routes/courses.js';
import { registerCourseInstructorRoutes } from './routes/courseInstructors.js';
import { registerModuleRoutes } from './routes/modules.js';
import { registerLessonRoutes } from './routes/lessons.js';
import { registerEnrollmentRoutes } from './routes/enrollments.js';
import { registerProgressRoutes } from './routes/progress.js';
import { registerActivityRoutes } from './routes/activity.js';
import { registerGradeRoutes } from './routes/grades.js';
import { registerFeedbackRoutes } from './routes/feedback.js';
import { registerCourseCommentRoutes } from './routes/courseComments.js';
import { registerCalendarRoutes } from './routes/calendar.js';
import { registerAnnouncementRoutes } from './routes/announcements.js';
import { registerQuestionBankRoutes } from './routes/questionBanks.js';
import { registerExamRoutes } from './routes/exams.js';
import { registerUserRoutes } from './routes/users.js';
import { registerAdminUserRoutes } from './routes/adminUsers.js';
import { registerNavItemRoutes } from './routes/nav-items.js';
import { registerPaymentRoutes } from './routes/payments.js';
import { httpPaytrClient, type PaytrClient } from './lib/paytr.js';

export interface BuildAppOptions {
  /** Testlerde PayTR ağ çağrısını sahte istemciyle değiştirmek için. */
  paytrClient?: PaytrClient;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  // TRUST_PROXY=1: tünel/ters vekil arkasında request.ip gerçek istemci IP'si olur (PayTR user_ip ister).
  const app = Fastify({ logger: true, trustProxy: process.env.TRUST_PROXY === '1' });
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Kaynak bulunamadı.' } });
  });

  // Accept an empty body with `Content-Type: application/json` (bodyless PUT/DELETE);
  // non-empty bodies still go through Fastify's default parser (same invalid-JSON behavior).
  const defaultJsonParser = app.getDefaultJsonParser('error', 'error');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    if (body === '' || (typeof body === 'string' && body.trim() === '')) {
      done(null, undefined);
      return;
    }
    defaultJsonParser(request, body as string, done);
  });

  await app.register(cors, { origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' });
  // PayTR bildirimi application/x-www-form-urlencoded gelir.
  await app.register(formbody);

  app.get('/api/v1/health', async () => ({ status: 'ok' }));
  registerAuthRoutes(app);
  registerCourseRoutes(app);
  registerCourseInstructorRoutes(app);
  registerModuleRoutes(app);
  registerLessonRoutes(app);
  registerEnrollmentRoutes(app);
  registerProgressRoutes(app);
  registerActivityRoutes(app);
  registerGradeRoutes(app);
  registerFeedbackRoutes(app);
  registerCourseCommentRoutes(app);
  registerCalendarRoutes(app);
  registerAnnouncementRoutes(app);
  registerQuestionBankRoutes(app);
  registerExamRoutes(app);
  registerUserRoutes(app);
  registerAdminUserRoutes(app);
  registerNavItemRoutes(app);
  registerPaymentRoutes(app, options.paytrClient ?? httpPaytrClient);

  await app.ready();
  return app;
}
