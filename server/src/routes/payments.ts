import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/rbac.js';
import { AppError } from '../errors.js';
import {
  buildBasket,
  getPaytrConfig,
  newMerchantOid,
  verifyCallbackHash,
  type PaytrCallbackBody,
  type PaytrClient,
} from '../lib/paytr.js';

export function registerPaymentRoutes(app: FastifyInstance, paytr: PaytrClient) {
  // 1. ADIM: sipariş oluştur, PayTR'dan iframe token al.
  app.post<{ Params: { courseId: string } }>(
    '/api/v1/courses/:courseId/checkout',
    { preHandler: [requireAuth] },
    async (request) => {
      const cfg = getPaytrConfig();
      if (!cfg) {
        throw new AppError('PAYMENT_NOT_CONFIGURED', 'Ödeme sistemi şu anda kullanılamıyor.', 503);
      }
      const course = await prisma.course.findUnique({ where: { id: request.params.courseId } });
      if (!course || course.status !== 'PUBLISHED') {
        throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
      }
      if (course.priceKurus <= 0) {
        throw new AppError('COURSE_IS_FREE', 'Bu kurs ücretsizdir, doğrudan kayıt olabilirsiniz.', 400);
      }
      const userId = request.user!.userId;
      const existing = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: course.id } },
      });
      if (existing) {
        throw new AppError('ALREADY_ENROLLED', 'Bu kursa zaten kayıtlısınız.', 409);
      }
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

      const order = await prisma.order.create({
        data: {
          merchantOid: newMerchantOid(),
          userId,
          courseId: course.id,
          amountKurus: course.priceKurus,
          testMode: cfg.testMode,
        },
      });

      const result = await paytr.getIframeToken(cfg, {
        userIp: request.ip,
        merchantOid: order.merchantOid,
        email: user.email,
        paymentAmount: order.amountKurus,
        userBasket: buildBasket(course.title, course.priceKurus),
        noInstallment: 0,
        maxInstallment: 0,
        currency: 'TL',
        userName: user.name.slice(0, 60),
        // Dijital ürün: sistemde adres ve telefon tutulmuyor; PayTR alanları zorunlu kıldığı için yer tutucu.
        userAddress: 'Dijital eğitim hizmeti',
        userPhone: '05000000000',
        okUrl: `${cfg.webBaseUrl}/odeme/sonuc?oid=${order.merchantOid}`,
        failUrl: `${cfg.webBaseUrl}/odeme/sonuc?oid=${order.merchantOid}`,
      });

      if (result.status !== 'success') {
        request.log.error({ merchantOid: order.merchantOid, reason: result.reason }, 'PayTR token alınamadı');
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'FAILED', failedReasonMsg: 'Ödeme başlatılamadı.' },
        });
        throw new AppError('PAYMENT_PROVIDER_ERROR', 'Ödeme başlatılamadı. Lütfen daha sonra tekrar deneyin.', 502);
      }
      return { merchantOid: order.merchantOid, iframeToken: result.token };
    },
  );

  // 2. ADIM: PayTR bildirim URL'si. Oturum yok; yanıt yalnızca düz metin "OK" olmalı.
  app.post<{ Body: PaytrCallbackBody }>('/api/v1/payments/paytr/callback', async (request, reply) => {
    const cfg = getPaytrConfig();
    const body = request.body ?? {};
    if (!cfg || !verifyCallbackHash(cfg, body)) {
      request.log.warn({ merchantOid: body.merchant_oid }, 'PayTR bildirimi reddedildi: geçersiz hash');
      throw new AppError('INVALID_HASH', 'Geçersiz bildirim.', 400);
    }

    const order = await prisma.order.findUnique({ where: { merchantOid: body.merchant_oid! } });
    if (!order) {
      // Bilinmeyen sipariş için tekrar denemenin anlamı yok; PayTR'ın ısrarını kesmek için OK.
      request.log.error({ merchantOid: body.merchant_oid }, 'PayTR bildirimi: sipariş bulunamadı');
    } else if (order.status === 'PENDING') {
      const common = {
        totalAmountKurus: Number(body.total_amount),
        paymentType: body.payment_type ?? null,
      };
      if (body.status === 'success') {
        await prisma.$transaction([
          prisma.order.update({
            where: { id: order.id },
            data: { ...common, status: 'PAID', paidAt: new Date() },
          }),
          prisma.enrollment.upsert({
            where: { userId_courseId: { userId: order.userId, courseId: order.courseId } },
            create: { userId: order.userId, courseId: order.courseId, method: 'PAID' },
            update: {},
          }),
        ]);
      } else {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            ...common,
            status: 'FAILED',
            failedReasonCode: body.failed_reason_code ?? null,
            failedReasonMsg: body.failed_reason_msg ?? null,
          },
        });
      }
    }
    // Tekrarlayan bildirimler (sipariş PENDING değil) yalnızca OK ile kapatılır.
    reply.type('text/plain').send('OK');
  });

  app.get<{ Params: { merchantOid: string } }>(
    '/api/v1/payments/:merchantOid',
    { preHandler: [requireAuth] },
    async (request) => {
      const order = await prisma.order.findUnique({
        where: { merchantOid: request.params.merchantOid },
        include: { course: { select: { title: true } } },
      });
      if (!order || order.userId !== request.user!.userId) {
        throw new AppError('NOT_FOUND', 'Sipariş bulunamadı.', 404);
      }
      return {
        order: {
          merchantOid: order.merchantOid,
          status: order.status,
          courseId: order.courseId,
          courseTitle: order.course.title,
          amountKurus: order.amountKurus,
          failedReasonMsg: order.failedReasonMsg,
        },
      };
    },
  );
}
