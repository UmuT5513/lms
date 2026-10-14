import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  buildBasket,
  buildCallbackHash,
  buildIframeTokenHash,
  getPaytrConfig,
  newMerchantOid,
  verifyCallbackHash,
  type PaytrConfig,
} from './paytr.js';

const cfg: PaytrConfig = {
  merchantId: '123456',
  merchantKey: 'anahtar',
  merchantSalt: 'tuz',
  testMode: true,
  webBaseUrl: 'http://localhost:5173',
};

describe('paytr yardımcıları', () => {
  it('mağaza bilgileri eksikse yapılandırma null döner', () => {
    expect(getPaytrConfig({})).toBeNull();
    expect(
      getPaytrConfig({ PAYTR_MERCHANT_ID: '1', PAYTR_MERCHANT_KEY: 'k', PAYTR_MERCHANT_SALT: 's', PAYTR_TEST_MODE: '1' }),
    ).toMatchObject({ merchantId: '1', testMode: true });
  });

  it('iframe token hash resmi örnekteki sırayla hesaplanır', () => {
    const p = {
      userIp: '1.2.3.4', merchantOid: 'LMS1', email: 'a@b.c', paymentAmount: 4999,
      userBasket: 'YmFza2V0', noInstallment: 0 as const, maxInstallment: 0, currency: 'TL' as const,
    };
    const expected = createHmac('sha256', 'anahtar')
      .update('1234561.2.3.4LMS1a@b.c4999YmFza2V000TL1' + 'tuz')
      .digest('base64');
    expect(buildIframeTokenHash(cfg, p)).toBe(expected);
  });

  it('bildirim hash doğrulaması doğruyu kabul eder, değiştirilmişi reddeder', () => {
    const body = { merchant_oid: 'LMS1', status: 'success', total_amount: '4999' };
    const hash = buildCallbackHash(cfg, body);
    expect(hash).toBe(createHmac('sha256', 'anahtar').update('LMS1tuzsuccess4999').digest('base64'));
    expect(verifyCallbackHash(cfg, { ...body, hash })).toBe(true);
    expect(verifyCallbackHash(cfg, { ...body, total_amount: '1', hash })).toBe(false);
    expect(verifyCallbackHash(cfg, { ...body, hash: 'kisa' })).toBe(false);
    expect(verifyCallbackHash(cfg, { ...body })).toBe(false);
  });

  it('sepet base64 JSON ve iki ondalıklı birim fiyat içerir', () => {
    const decoded = JSON.parse(Buffer.from(buildBasket('Kurs', 4999), 'base64').toString());
    expect(decoded).toEqual([['Kurs', '49.99', 1]]);
  });

  it('merchant_oid alfanümerik ve 64 karakterden kısa, her seferinde farklı', () => {
    const a = newMerchantOid();
    expect(a).toMatch(/^[A-Za-z0-9]{1,64}$/);
    expect(newMerchantOid()).not.toBe(a);
  });
});
