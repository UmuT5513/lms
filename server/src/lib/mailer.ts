import type { FastifyBaseLogger } from 'fastify';

/**
 * Şifre sıfırlama e-postası. Henüz SMTP yok: bağlantı sunucu log'una yazılır.
 * Gerçek gönderim eklenirken yalnızca bu fonksiyonun gövdesi değişir.
 */
export async function sendPasswordResetEmail(
  to: string,
  link: string,
  log: FastifyBaseLogger,
): Promise<void> {
  log.info({ to, link }, 'Şifre sıfırlama bağlantısı (e-posta gönderilmedi, yalnızca log)');
}
