import { describe, expect, it } from 'vitest';
import { allowedCheckoutUrl, usableCheckout } from './checkout';
import type { CheckoutState } from './checkout';
const pending: CheckoutState = { orderId: 'order-1', provider: 'mercadopago-sandbox', status: 'pending', paymentStatus: 'pending', checkoutUrl: 'https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=test', expiresAt: null, canRetry: false };
describe('External sandbox checkout boundaries', () => {
  it('allows exact provider HTTPS hosts, not lookalikes, credentials, custom ports or script URLs', () => {
    expect(allowedCheckoutUrl(pending.checkoutUrl)).toBe(pending.checkoutUrl);
    for (const url of ['https://www.mercadopago.com.evil.test/pay', 'https://user@www.mercadopago.com/pay', 'https://www.mercadopago.com:8443/pay', 'http://sandbox.mercadopago.com/pay', 'javascript:alert(1)', '//www.mercadopago.com/pay']) expect(allowedCheckoutUrl(url)).toBeNull();
  });
  it('does not allow another checkout after authoritative approval, cancellation or expiry', () => {
    expect(usableCheckout(pending)).toBe(pending.checkoutUrl);
    expect(usableCheckout({ ...pending, paymentStatus: 'approved' })).toBeNull();
    expect(usableCheckout({ ...pending, status: 'cancelled' })).toBeNull();
    expect(usableCheckout({ ...pending, expiresAt: '2020-01-01T00:00:00Z' })).toBeNull();
    expect(usableCheckout({ ...pending, expiresAt: 'invalid' })).toBeNull();
    expect(usableCheckout({ ...pending, provider: 'simulator' })).toBeNull();
  });
});
