export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787').replace(/\/$/, '');
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
export const DEV_USER_COOKIE = 'ft_dev_user';

export const DEMO_USERS = [
  { id: 'user_demo_admin', role: 'admin' },
  { id: 'user_demo_editor', role: 'editor' },
  { id: 'user_demo_viewer', role: 'viewer' },
  { id: 'user_demo_outsider', role: 'outsider' },
] as const;
