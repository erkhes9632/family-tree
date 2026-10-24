import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export class ApiError extends HTTPException {
  constructor(
    status: ContentfulStatusCode,
    readonly code: string,
    message?: string,
    readonly details?: unknown,
  ) {
    super(status, { message: message ?? code });
  }
}

export const unauthorized = () => new ApiError(401, 'unauthorized', 'Sign in required');
export const forbidden = (message = 'Not allowed') => new ApiError(403, 'forbidden', message);
export const notFound = (what = 'Resource') => new ApiError(404, 'not_found', `${what} not found`);
export const badRequest = (message: string, details?: unknown) => new ApiError(400, 'bad_request', message, details);
export const conflict = (message: string) => new ApiError(409, 'conflict', message);
export const tooMany = () => new ApiError(429, 'rate_limited', 'Too many requests, slow down');
