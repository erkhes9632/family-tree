'use client';
import * as React from 'react';
import { API_URL } from './config';
import { useAuthState } from './auth';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface Api {
  get<T>(path: string, query?: Query): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  del<T = void>(path: string, body?: unknown): Promise<T>;
}

export function createApi(getToken: () => Promise<string | null>): Api {
  async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
    const url = new URL(`${API_URL}/v1${path}`);
    for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    const token = await getToken();
    const res = await fetch(url, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = (data as { error?: { code: string; message: string; details?: unknown } } | null)?.error;
      throw new ApiError(res.status, err?.code ?? 'error', err?.message ?? res.statusText, err?.details);
    }
    return data as T;
  }
  return {
    get: (p, q) => request('GET', p, undefined, q),
    post: (p, b) => request('POST', p, b ?? {}),
    patch: (p, b) => request('PATCH', p, b ?? {}),
    put: (p, b) => request('PUT', p, b ?? {}),
    del: (p, b) => request('DELETE', p, b),
  };
}

export function useApi(): Api {
  const { getToken } = useAuthState();
  return React.useMemo(() => createApi(getToken), [getToken]);
}
