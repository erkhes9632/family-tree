import { SiteFooter } from '@/components/layout/site-footer';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
