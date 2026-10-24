import { clerkMiddleware } from '@clerk/nextjs/server';
import createIntlMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intl = createIntlMiddleware(routing);
const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Edge middleware (not Next 16 proxy.ts): Node.js middleware is experimental on OpenNext/Cloudflare.
// Authorization is enforced by the API; this only handles locale routing (and Clerk session sync when enabled).
export default clerkEnabled ? clerkMiddleware((_auth, req) => intl(req)) : (req: NextRequest) => intl(req);

export const config = {
  matcher: ['/((?!api|trpc|_next|_vercel|__clerk|.*\\..*).*)'],
};
