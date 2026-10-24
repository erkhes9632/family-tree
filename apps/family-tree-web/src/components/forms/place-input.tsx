'use client';
import { useTranslations } from 'next-intl';
import type { Place } from '@super-project/types';
import { Input } from '@/components/ui/input';

/** Mongolian administrative place (аймаг / сум / баг) or free text, plus country. */
export function PlaceInput({ value, onChange, label, id }: { value: Place | null | undefined; onChange: (v: Place | null) => void; label: string; id: string }) {
  const t = useTranslations('place');
  const v = value ?? {};
  const set = (k: keyof Place, s: string) => {
    const next = { ...v, [k]: s || null };
    onChange(Object.values(next).some(Boolean) ? next : null);
  };
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Input id={id} aria-label={t('aimag')} placeholder={t('aimag')} value={v.aimag ?? ''} onChange={(e) => set('aimag', e.target.value)} />
        <Input aria-label={t('sum')} placeholder={t('sum')} value={v.sum ?? ''} onChange={(e) => set('sum', e.target.value)} />
        <Input aria-label={t('bag')} placeholder={t('bag')} value={v.bag ?? ''} onChange={(e) => set('bag', e.target.value)} />
        <Input aria-label={t('country')} placeholder={t('country')} value={v.country ?? ''} onChange={(e) => set('country', e.target.value)} />
        <Input className="col-span-2 sm:col-span-4" aria-label={t('text')} placeholder={t('text')} value={v.text ?? ''} onChange={(e) => set('text', e.target.value)} />
      </div>
    </fieldset>
  );
}

export function formatPlace(p: Place | null | undefined): string {
  if (!p) return '';
  return [p.text, p.bag, p.sum, p.aimag, p.country].filter(Boolean).join(', ');
}
