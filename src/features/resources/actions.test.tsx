import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { ResourcePage } from './ResourcePage';
import { RolesPage } from '../roles/RolesPage';
import { PaymentCheckoutDialog } from '../payments/PaymentCheckoutDialog';

const { get, post, put, remove } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), remove: vi.fn() }));
vi.mock('../../services/api', () => ({ api: { get, post, put, delete: remove }, apiError: (error: unknown) => ({ message: String(error) }) }));
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ can: () => true, refresh: async () => {}, session: { user: { id: 'operator' } } }) }));
function page(items: unknown[]) { return { data: { items, page: 1, pageSize: 10, totalCount: items.length, totalPages: 1, hasNextPage: false, hasPreviousPage: false } }; }
function mount(children: ReactNode) { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><BrowserRouter>{children}</BrowserRouter></QueryClientProvider>); }
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
  post.mockResolvedValue({ data: {} }); put.mockResolvedValue({ data: {} }); remove.mockResolvedValue({ data: {} });
});

describe('Confirmed operational mutations', () => {
  it('never accepts an approved browser return as payment confirmation', async () => {
    history.replaceState(null, '', '/payments?status=approved&collection_status=approved');
    get.mockResolvedValue({ data: { orderId: 'order-1', provider: 'mercadopago-sandbox', status: 'pending', paymentStatus: 'pending', checkoutUrl: 'https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=test', expiresAt: null, canRetry: false } });
    post.mockResolvedValue({ status: 202, data: {} });
    mount(<PaymentCheckoutDialog orderId="order-1" onClose={() => {}} />);
    await screen.findByRole('link', { name: /Abrir checkout de pruebas/ });
    expect(screen.queryByText('Aprobado', { exact: true })).toBeNull();
    expect(screen.getByText('Pendiente', { exact: true })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Verificar con proveedor' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/payments/orders/order-1/reconcile'));
    await screen.findByText('Verificación solicitada. El estado solo cambia cuando el backend confirma el resultado con el proveedor.');
    expect(screen.getByText('Pendiente', { exact: true })).toBeTruthy();
    expect(screen.queryByText('Aprobado', { exact: true })).toBeNull();
    history.replaceState(null, '', '/');
  });
  it('requires confirmation and never offers manual approval for non-simulator payments', async () => {
    get.mockImplementation(async (url: string) => url === '/auth/config'
      ? { data: { simulationEnabled: true } }
      : page([{ id: 'sim-1', orderId: 'order-1', status: 'pending', provider: 'simulator', amount: 12000 }, { id: 'external-1', orderId: 'order-2', status: 'pending', provider: 'mercadopago', amount: 15000 }]));
    mount(<ResourcePage resource="payments" />);
    const approve = await screen.findByRole('button', { name: 'Aprobar pago de prueba SIM-1' });
    expect(screen.queryByRole('button', { name: /Aprobar pago de prueba EXTERNAL/ })).toBeNull();
    fireEvent.click(approve);
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar resultado de prueba' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/payments/sim-1/simulate', { outcome: 'approved' }));
  });

  it('hides simulation controls for stored demo payments when the API disables simulation', async () => {
    get.mockImplementation(async (url: string) => url === '/auth/config'
      ? { data: { simulationEnabled: false } }
      : page([{ id: 'sim-1', orderId: 'order-1', status: 'pending', provider: 'simulator', amount: 12000 }]));
    mount(<ResourcePage resource="payments" />);
    await screen.findByRole('button', { name: 'Ver pago SIM-1' });
    expect(get).toHaveBeenCalledWith('/auth/config');
    expect(screen.queryByRole('button', { name: /pago de prueba/ })).toBeNull();
  });

  it('keeps a protected role read-only and deletes an unprotected role only after confirmation', async () => {
    get.mockImplementation((url: string) => Promise.resolve(url === '/roles' ? page([{ id: 'protected', name: 'SUPER_ADMIN', protected: true, permissions: ['orders.read'], permissionCount: 1 }, { id: 'custom', name: 'CUSTOM', protected: false, permissions: [], permissionCount: 0 }]) : page([{ name: 'orders.read', module: 'orders' }])));
    mount(<RolesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Seleccionar rol SUPER_ADMIN' }));
    expect(screen.queryByRole('button', { name: 'Eliminar rol SUPER_ADMIN' })).toBeNull();
    expect((await screen.findByRole('checkbox', { name: 'orders.read' }) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar rol CUSTOM' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar rol CUSTOM' }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith('/roles/custom'));
  });

  it('loads webhook delivery history from its own paginated endpoint without unsupported search controls', async () => {
    get.mockResolvedValue(page([{ id: 'delivery-1', subscriptionId: 'subscription-1', eventId: 'event-1', status: 'failed', attempts: 3, statusCode: 503, lastError: 'Remote unavailable' }]));
    mount(<ResourcePage resource="webhook-deliveries" />);
    await screen.findByText('Remote unavailable');
    expect(get).toHaveBeenCalledWith('/webhook-deliveries', { params: { page: 1, pageSize: 10 } });
    expect(screen.queryByRole('button', { name: 'Filtros' })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
