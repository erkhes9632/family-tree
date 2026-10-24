import { cn } from '@/lib/utils';

/** Mark: a stylised tree whose roots echo the soyombo's horizontal bars. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-8', className)}>
      <circle cx="16" cy="16" r="15" className="fill-primary" />
      <path d="M16 7v18M16 12l-5-3M16 12l5-3M16 17l-6-3M16 17l6-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary-foreground" fill="none" />
      <path d="M10 23h12M12 26h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-gold" />
    </svg>
  );
}
