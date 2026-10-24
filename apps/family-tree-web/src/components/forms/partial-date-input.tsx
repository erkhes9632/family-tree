'use client';
import { useTranslations } from 'next-intl';
import type { DateQualifier, PartialDate } from '@super-project/types';
import { DATE_QUALIFIERS } from '@super-project/types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** Year / month / day / qualifier — supports "year only", "about 1920", "before 1900". */
export function PartialDateInput({
  value,
  onChange,
  id,
  label,
}: {
  value: PartialDate | null | undefined;
  onChange: (v: PartialDate | null) => void;
  id: string;
  label: string;
}) {
  const t = useTranslations('date');
  const v = value ?? null;
  const set = (patch: Partial<PartialDate>) => {
    const next = { year: v?.year ?? null, month: v?.month ?? null, day: v?.day ?? null, qualifier: v?.qualifier ?? 'exact', ...patch };
    if (next.month == null) next.day = null;
    onChange(next.year == null && next.month == null ? null : next);
  };
  const num = (s: string) => (s.trim() === '' ? null : Number(s));
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 sm:grid-cols-[minmax(7rem,1.2fr)_1.3fr_1fr_1fr]">
        <Select value={v?.qualifier ?? 'exact'} onValueChange={(q) => set({ qualifier: q as DateQualifier })}>
          <SelectTrigger aria-label={t('qualifier')} className="col-span-3 sm:col-span-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_QUALIFIERS.map((q) => (
              <SelectItem key={q} value={q}>
                {t(`q.${q}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input id={id} inputMode="numeric" aria-label={t('year')} placeholder={t('year')} value={v?.year ?? ''} onChange={(e) => set({ year: num(e.target.value.replace(/\D/g, '').slice(0, 4)) })} />
        <Input inputMode="numeric" aria-label={t('month')} placeholder={t('month')} value={v?.month ?? ''} onChange={(e) => { const m = num(e.target.value.replace(/\D/g, '').slice(0, 2)); set({ month: m && m >= 1 && m <= 12 ? m : null }); }} />
        <Input inputMode="numeric" aria-label={t('day')} placeholder={t('day')} disabled={!v?.month} value={v?.day ?? ''} onChange={(e) => { const d = num(e.target.value.replace(/\D/g, '').slice(0, 2)); set({ day: d && d >= 1 && d <= 31 ? d : null }); }} />
      </div>
    </fieldset>
  );
}
