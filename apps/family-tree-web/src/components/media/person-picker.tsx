'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronDown, X } from 'lucide-react';
import type { PersonSummary } from '@super-project/types';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/misc';

/** Multi-select of people in a tree (for tagging media / stories). */
export function PersonPicker({
  persons,
  value,
  onChange,
  label,
  single = false,
}: {
  persons: PersonSummary[];
  value: string[];
  onChange: (ids: string[]) => void;
  label: string;
  single?: boolean;
}) {
  const t = useTranslations('common');
  const [q, setQ] = React.useState('');
  const byId = React.useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    return persons.filter((p) => !s || `${p.givenName} ${p.patronymic ?? ''}`.toLowerCase().includes(s)).slice(0, 50);
  }, [persons, q]);
  const toggle = (id: string) => {
    if (single) onChange(value[0] === id ? [] : [id]);
    else onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="flex min-h-10 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-card px-2 py-1.5 text-left text-sm" aria-label={label}>
            {value.length === 0 && <span className="px-1 text-muted-foreground">{t('choose')}</span>}
            {value.map((id) => (
              <span key={id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs">
                {byId.get(id)?.givenName ?? '?'}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={t('remove')}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(id);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && toggle(id)}
                >
                  <X className="size-3" />
                </span>
              </span>
            ))}
            <ChevronDown className="ml-auto size-4 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} aria-label={t('search')} className="mb-2 h-9" />
          <ul role="listbox" aria-multiselectable={!single} className="max-h-60 overflow-y-auto">
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value.includes(p.id)}
                  onClick={() => toggle(p.id)}
                  className={cn('flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted', value.includes(p.id) && 'font-medium')}
                >
                  <span>
                    {p.givenName} <span className="text-muted-foreground">{p.patronymic}</span>
                  </span>
                  {value.includes(p.id) && <Check className="size-4 text-primary" />}
                </button>
              </li>
            ))}
            {!filtered.length && <li className="px-2 py-3 text-center text-sm text-muted-foreground">{t('noResults')}</li>}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}
