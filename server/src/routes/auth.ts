import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { signToken, type TokenPayload } from '../lib/jwt.js';
import { requireAuth } from '../middleware/rbac.js';
import { AppError } from '../errors.js';
import { toPublicUser } from '../lib/publicUser.js';
import { parseRoles } from '../lib/users.js';
import { sendPasswordResetEmail } from '../lib/mailer.js';

interface RegisterBody {
  email: string;
  password: string;
  name: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface ForgotPasswordBody {
  email: string;
}

interface ResetPasswordBody {
  token: string;
  password: string;
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

interface SwitchRoleBody {
  role: TokenPayload['role'];
}

export function registerAuthRoutes(app: FastifyInstance) {
  app.post<{ Body: RegisterBody }>('/api/v1/auth/register', async (request) => {
    const { email, password, name } = request.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new AppError('INVALID_EMAIL', 'Geçerli bir e-posta adresi girin.', 400);
    }
    if (typeof password !== 'string' || password.length < 8) {
      throw new AppError('WEAK_PASSWORD', 'Şifre en az 8 karakter olmalıdır.', 400);
    }
    if (!name || name.trim().length === 0) {
      throw new AppError('INVALID_NAME', 'Ad soyad boş olamaz.', 400);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError('EMAIL_TAKEN', 'Bu e-posta ile zaten bir hesap var.', 409);
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role: 'STUDENT', roles: 'STUDENT' },
    });
    const roles = parseRoles(user);
    const token = signToken({ userId: user.id, role: user.role as TokenPayload['role'], roles });
    return { user: toPublicUser(user), token };
  });

  app.post<{ Body: LoginBody }>('/api/v1/auth/login', async (request) => {
    const { email, password } = request.body;
    const user = await prisma.user.findUnique({ where: { email } });
    const genericError = () =>
      new AppError('INVALID_CREDENTIALS', 'E-posta veya şifre hatalı.', 401);
    if (!user) throw genericError();
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw genericError();
    // Yalnızca doğru şifreden sonra söylenir; aksi halde hesabın varlığı sızar.
    if (user.disabledAt) {
      throw new AppError('ACCOUNT_DISABLED', 'Hesabınız devre dışı bırakılmış. Yöneticinizle iletişime geçin.', 403);
    }
    const roles = parseRoles(user);
    const token = signToken({ userId: user.id, role: user.role as TokenPayload['role'], roles });
    return { user: toPublicUser(user), token };
  });

  app.post<{ Body: ForgotPasswordBody }>('/api/v1/auth/forgot-password', async (request) => {
    const email = typeof request.body?.email === 'string' ? request.body.email.trim() : '';
    const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

    if (user && !user.disabledAt) {
      const token = randomBytes(32).toString('hex');
      await prisma.$transaction([
        prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
        prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
          },
        }),
      ]);
      const base = process.env.WEB_BASE_URL ?? 'http://localhost:5173';
      await sendPasswordResetEmail(user.email, `${base}/sifre-sifirla?token=${token}`, request.log);
    }

    // Hesap var/yok fark etmeksizin aynı yanıt: hesabın varlığı sızmaz.
    return { ok: true };
  });

  app.post<{ Body: ResetPasswordBody }>('/api/v1/auth/reset-password', async (request) => {
    const { token, password } = request.body ?? {};
    if (typeof password !== 'string' || password.length < 8) {
      throw new AppError('WEAK_PASSWORD', 'Şifre en az 8 karakter olmalıdır.', 400);
    }
    const invalid = () =>
      new AppError('INVALID_RESET_TOKEN', 'Sıfırlama bağlantısı geçersiz veya süresi dolmuş.', 400);
    if (typeof token !== 'string' || !token) throw invalid();

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) throw invalid();

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    return { ok: true };
  });

  app.get(
    '/api/v1/auth/me',
    { preHandler: [requireAuth] },
    async (request) => {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user!.userId } });
      return { user: toPublicUser(user) };
    },
  );

  app.post<{ Body: SwitchRoleBody }>(
    '/api/v1/auth/switch-role',
    { preHandler: [requireAuth] },
    async (request) => {
      const { role: requestedRole } = request.body ?? {};
      const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user!.userId } });
      const roles = parseRoles(user);

      if (!roles.includes(requestedRole)) {
        throw new AppError('ROLE_NOT_ASSIGNED', 'Bu role sahip değilsiniz.', 403);
      }

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { role: requestedRole },
      });

      const token = signToken({ userId: updatedUser.id, role: requestedRole, roles });
      return { user: toPublicUser(updatedUser), token };
    },
  );
}
