export type Entity = Record<string, unknown> & { id?: string };
export interface Page<T = Entity> { items: T[]; page: number; pageSize: number; totalCount: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean }
export interface User { id: string; email: string; displayName: string; partnerId?: string }
export interface Session { accessToken?: string; user: User; permissions: string[]; expiresAt?: string }
export interface Problem { title?: string; detail?: string; status?: number; errorCode?: string; correlationId?: string; validationErrors?: Record<string, string[]> }
export interface Dashboard { metrics: Record<string, number | null>; partnerMetricsAvailable?: boolean; ordersByDay: Array<{ date: string; count: number; total: number }>; ordersByStatus: Array<{ status: string; count: number }>; ordersByChannel: Array<{ channel: string; count: number }>; recentOrders: Entity[]; recentActivity: Entity[]; integrations: Entity[] }
declare global { interface Window { __VORTEX_CONFIG__?: Record<string, string> } }
