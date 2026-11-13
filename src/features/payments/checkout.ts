export interface CheckoutState {
  orderId: string;
  provider: 'mercadopago-sandbox' | 'simulator';
  status: string;
  checkoutUrl: string | null;
  expiresAt: string | null;
  paymentStatus: string;
  canRetry: false;
}
const checkoutHosts = new Set(['www.mercadopago.com.co', 'www.mercadopago.com', 'sandbox.mercadopago.com']);
export function allowedCheckoutUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (!url.port || url.port === '443') && !url.username && !url.password && checkoutHosts.has(url.hostname) ? url.href : null;
  } catch { return null; }
}
export function usableCheckout(state: CheckoutState, now = Date.now()): string | null {
  if (state.provider !== 'mercadopago-sandbox' || state.paymentStatus !== 'pending' || state.status !== 'pending') return null;
  if (state.expiresAt && (!Number.isFinite(Date.parse(state.expiresAt)) || Date.parse(state.expiresAt) <= now)) return null;
  return allowedCheckoutUrl(state.checkoutUrl);
}
export const checkoutLabels: Record<string, string> = { simulated: 'Pago simulado local', creating: 'Preparando checkout', pending: 'Pendiente de confirmación', unknown: 'Verificación pendiente', refund_pending: 'Reembolso pendiente', refunded: 'Reembolsado', manual_review: 'Revisión necesaria', cancelled: 'Cancelado', approved: 'Aprobado', rejected: 'Rechazado', expired: 'Checkout vencido' };
