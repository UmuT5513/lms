import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * PayTR iFrame API yardımcıları. Hash hesapları resmi entegrasyon paketindeki
 * Node örneğiyle birebir aynıdır (1. ADIM: get-token, 2. ADIM: bildirim).
 */

export interface PaytrConfig {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
  testMode: boolean;
  webBaseUrl: string;
}

/** Ortam değişkenlerinden okur; mağaza bilgileri eksikse null döner (ödeme kapalı). */
export function getPaytrConfig(env: NodeJS.ProcessEnv = process.env): PaytrConfig | null {
  const { PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT } = env;
  if (!PAYTR_MERCHANT_ID || !PAYTR_MERCHANT_KEY || !PAYTR_MERCHANT_SALT) return null;
  return {
    merchantId: PAYTR_MERCHANT_ID,
    merchantKey: PAYTR_MERCHANT_KEY,
    merchantSalt: PAYTR_MERCHANT_SALT,
    testMode: env.PAYTR_TEST_MODE === '1',
    webBaseUrl: env.WEB_BASE_URL ?? 'http://localhost:5173',
  };
}

/** PayTR merchant_oid: en fazla 64 karakter, yalnızca alfanümerik. */
export function newMerchantOid(): string {
  return `LMS${Date.now()}${randomBytes(6).toString('hex')}`;
}

/** user_basket: [[ad, birim fiyat "12.34", adet]] dizisinin base64 hali. */
export function buildBasket(title: string, priceKurus: number): string {
  const unitPrice = (priceKurus / 100).toFixed(2);
  return Buffer.from(JSON.stringify([[title, unitPrice, 1]])).toString('base64');
}

export interface IframeTokenParams {
  userIp: string;
  merchantOid: string;
  email: string;
  paymentAmount: number;
  userBasket: string;
  noInstallment: 0 | 1;
  maxInstallment: number;
  currency: 'TL';
}

export function buildIframeTokenHash(cfg: PaytrConfig, p: IframeTokenParams): string {
  const hashStr =
    `${cfg.merchantId}${p.userIp}${p.merchantOid}${p.email}${p.paymentAmount}${p.userBasket}` +
    `${p.noInstallment}${p.maxInstallment}${p.currency}${cfg.testMode ? 1 : 0}`;
  return createHmac('sha256', cfg.merchantKey).update(hashStr + cfg.merchantSalt).digest('base64');
}

export interface PaytrCallbackBody {
  merchant_oid?: string;
  status?: string;
  total_amount?: string;
  hash?: string;
  failed_reason_code?: string;
  failed_reason_msg?: string;
  test_mode?: string;
  payment_type?: string;
}

export function buildCallbackHash(
  cfg: PaytrConfig,
  b: { merchant_oid: string; status: string; total_amount: string },
): string {
  return createHmac('sha256', cfg.merchantKey)
    .update(`${b.merchant_oid}${cfg.merchantSalt}${b.status}${b.total_amount}`)
    .digest('base64');
}

/** Bildirimin PayTR'dan geldiğini ve değiştirilmediğini doğrular. */
export function verifyCallbackHash(cfg: PaytrConfig, b: PaytrCallbackBody): boolean {
  if (!b.merchant_oid || !b.status || b.total_amount === undefined || !b.hash) return false;
  const expected = Buffer.from(
    buildCallbackHash(cfg, { merchant_oid: b.merchant_oid, status: b.status, total_amount: b.total_amount }),
  );
  const received = Buffer.from(b.hash);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export type IframeTokenResult = { status: 'success'; token: string } | { status: 'failed'; reason: string };

export interface IframeTokenRequest extends IframeTokenParams {
  userName: string;
  userAddress: string;
  userPhone: string;
  okUrl: string;
  failUrl: string;
}

/** PayTR'a giden ağ çağrısı; testlerde sahte uygulamayla değiştirilir. */
export interface PaytrClient {
  getIframeToken(cfg: PaytrConfig, req: IframeTokenRequest): Promise<IframeTokenResult>;
}

export const httpPaytrClient: PaytrClient = {
  async getIframeToken(cfg, req) {
    const form = new URLSearchParams({
      merchant_id: cfg.merchantId,
      user_ip: req.userIp,
      merchant_oid: req.merchantOid,
      email: req.email,
      payment_amount: String(req.paymentAmount),
      paytr_token: buildIframeTokenHash(cfg, req),
      user_basket: req.userBasket,
      debug_on: cfg.testMode ? '1' : '0',
      no_installment: String(req.noInstallment),
      max_installment: String(req.maxInstallment),
      user_name: req.userName,
      user_address: req.userAddress,
      user_phone: req.userPhone,
      merchant_ok_url: req.okUrl,
      merchant_fail_url: req.failUrl,
      timeout_limit: '30',
      currency: req.currency,
      test_mode: cfg.testMode ? '1' : '0',
      lang: 'tr',
    });
    const res = await fetch('https://www.paytr.com/odeme/api/get-token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { status: 'failed', reason: `HTTP ${res.status}` };
    return (await res.json()) as IframeTokenResult;
  },
};
