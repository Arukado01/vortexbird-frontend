import axios from 'axios';
import { config } from '../lib/config';
import type { Problem } from '../types';
export const api = axios.create({ baseURL: config.apiUrl, timeout: 20000 });
let tokenProvider: (() => Promise<string | undefined>) | undefined;
export function setTokenProvider(provider?: () => Promise<string | undefined>) { tokenProvider = provider; }
api.interceptors.request.use(async request => { const token = await tokenProvider?.(); if (token) request.headers.Authorization = `Bearer ${token}`; request.headers['X-Correlation-ID'] = crypto.randomUUID(); return request; });
export function apiError(error: unknown) { if (axios.isAxiosError<Problem>(error)) { const p = error.response?.data; return { message: p?.detail ?? p?.title ?? (error.code === 'ERR_NETWORK' ? 'No se pudo conectar con la API. Verifica que los servicios estén disponibles.' : error.message), correlationId: p?.correlationId, status: error.response?.status }; } return { message: error instanceof Error ? error.message : 'Ocurrió un error inesperado.', correlationId: undefined, status: undefined }; }
