import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { ResourcePage } from './ResourcePage';
import { RolesPage } from '../roles/RolesPage';

const { get, post, put, remove } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), remove: vi.fn() }));
vi.mock('../../services/api', () => ({ api: { get, post, put, delete: remove }, apiError: (error: unknown) => ({ message: String(error) }) }));
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ can: () => true, refresh: async () => {}, session: { user: { id: 'operator' } } }) }));
function page(items: unknown[]) { return { data: { items, page: 1, pageSize: 15, totalCount: items.length, totalPages: 1, hasNextPage: false, hasPreviousPage: false } }; }
function mount(children: ReactNode) { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><BrowserRouter>{children}</BrowserRouter></QueryClientProvider>); }
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
  post.mockResolvedValue({ data: {} }); put.mockResolvedValue({ data: {} }); remove.mockResolvedValue({ data: {} });
});

describe('Confirmed operational mutations', () => {
  it('requires confirmation and never offers manual approval for non-simulator payments', async () => {
    get.mockResolvedValue(page([{ id: 'sim-1', orderId: 'order-1', status: 'pending', provider: 'simulator', amount: 12000 }, { id: 'external-1', orderId: 'order-2', status: 'pending', provider: 'mercadopago', amount: 15000 }]));
    mount(<ResourcePage resource="payments" />);
    const approve = await screen.findByRole('button', { name: 'Aprobar pago de prueba SIM-1' });
    expect(screen.queryByRole('button', { name: /Aprobar pago de prueba EXTERNAL/ })).toBeNull();
    fireEvent.click(approve);
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar resultado de prueba' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/payments/sim-1/simulate', { outcome: 'approved' }));
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
    expect(get).toHaveBeenCalledWith('/webhook-deliveries', { params: { page: 1, pageSize: 15 } });
    expect(screen.queryByRole('button', { name: 'Filtros' })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

