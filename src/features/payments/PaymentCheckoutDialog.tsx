import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';
import { date, shortId } from '../../lib/format';
import { Button, ErrorState, Modal, Skeleton, Status } from '../../components/ui';
import { useAuth } from '../auth/AuthProvider';
import type { CheckoutState } from './checkout';
import { checkoutLabels, usableCheckout } from './checkout';

export function PaymentCheckoutDialog({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const auth = useAuth(); const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['checkout', orderId],
    queryFn: async () => (await api.get<CheckoutState>(`/payments/orders/${orderId}/checkout`)).data,
    refetchOnWindowFocus: true,
    refetchInterval: current => ['creating', 'pending', 'unknown', 'refund_pending'].includes(current.state.data?.status ?? '') ? 5000 : false,
  });
  const reconcile = useMutation({
    mutationFn: () => api.post(`/payments/orders/${orderId}/reconcile`),
    onSuccess: async () => {
      // A 202 means accepted for verification, never payment approval.
      await query.refetch();
      for (const key of ['payments', 'order', 'orders', 'dashboard']) void qc.invalidateQueries({ queryKey: [key] });
    },
  });
  const state = query.data;
  const checkoutUrl = state ? usableCheckout(state) : null;
  return <Modal title={`Pago de la orden #${shortId(orderId)}`} description="El estado mostrado proviene de la API. Volver desde el checkout no confirma el pago." onClose={onClose}>
    {query.isPending ? <Skeleton rows={3} /> : query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : state && <div className="checkout-summary">
      <div className="notice"><ShieldCheck size={17} />{state.provider === 'simulator' ? 'Esta orden usa el simulador local. No tiene checkout externo.' : 'Mercado Pago · Ambiente de pruebas. Usa únicamente comprador y datos de pago de prueba.'}</div>
      <div className="checkout-status" role="status" aria-live="polite"><strong>Estado confirmado por la API:</strong><Status value={state.paymentStatus} /></div>
      <p className="checkout-help" style={{ marginTop: 14 }}>{checkoutLabels[state.status] ?? state.status}</p>
      {state.provider === 'mercadopago-sandbox' && <>
        {state.status === 'unknown' && <p className="checkout-help">La plataforma está verificando el resultado con el proveedor. Mantén esta orden para consultar su evolución.</p>}
        {state.checkoutUrl && !checkoutUrl && state.paymentStatus === 'pending' && <p className="checkout-blocked" role="status">El enlace no está habilitado para el estado actual, está vencido o no coincide con un destino permitido.</p>}
        <div className="checkout-actions">
          {checkoutUrl && <a className="button button-primary checkout-external" href={checkoutUrl} target="_blank" rel="noopener noreferrer">Abrir checkout de pruebas<ExternalLink size={15} /><span className="sr-only">(abre una pestaña nueva)</span></a>}
          <Button variant="secondary" disabled={query.isFetching || reconcile.isPending} onClick={() => void query.refetch()}><RefreshCw size={15} />Consultar estado</Button>
          {auth.can('payments.manage') && !['simulated', 'refunded'].includes(state.status) && <Button variant="secondary" disabled={reconcile.isPending} onClick={() => reconcile.mutate()}>{reconcile.isPending ? 'Verificando…' : 'Verificar con proveedor'}</Button>}
        </div>
        {reconcile.isSuccess && <p className="checkout-meta" role="status">Verificación solicitada. El estado solo cambia cuando el backend confirma el resultado con el proveedor.</p>}
        {reconcile.error && <ErrorState error={reconcile.error} />}
      </>}
      <p className="checkout-meta">Última consulta a la API: {date(new Date(query.dataUpdatedAt).toISOString())}{state.expiresAt && <> · Vigencia del checkout: {date(state.expiresAt)}</>}</p>
    </div>}
    <div className="modal-actions"><Button variant="secondary" onClick={onClose}>Cerrar</Button></div>
  </Modal>;
}
