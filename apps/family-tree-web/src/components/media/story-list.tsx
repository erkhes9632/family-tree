'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mic, Trash2 } from 'lucide-react';
import { formatPartialDate } from '@super-project/genealogy';
import type { PersonSummary, StoryDto } from '@super-project/types';
import { Link } from '@/i18n/navigation';
import { useApi } from '@/lib/api';
import { formatDuration } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { EmptyState } from '@/components/ui/misc';

export function StoryList({ stories, persons, canEdit, treeId }: { stories: StoryDto[]; persons: PersonSummary[]; canEdit: boolean; treeId: string }) {
  const t = useTranslations('stories');
  const tc = useTranslations('common');
  const locale = useLocale();
  const api = useApi();
  const qc = useQueryClient();
  if (!stories.length) return <EmptyState icon={<Mic />} title={t('empty')} description={t('emptyText')} />;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {stories.map((s) => {
        const person = persons.find((p) => p.id === s.personId);
        return (
          <li key={s.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-sans text-base font-semibold">{s.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {[person && (
                    <Link key="p" href={`/trees/${treeId}/people/${person.id}`} className="hover:underline">
                      {person.givenName}
                    </Link>
                  ), formatPartialDate(s.date, locale === 'mn' ? 'mn' : 'en'), s.media?.durationSec ? formatDuration(s.media.durationSec) : null]
                    .filter(Boolean)
                    .map((x, i) => (
                      <span key={i}>
                        {i > 0 && ' · '}
                        {x}
                      </span>
                    ))}
                </p>
              </div>
              {canEdit && (
                <ConfirmDialog
                  trigger={
                    <Button size="icon-sm" variant="ghost" aria-label={tc('delete')}>
                      <Trash2 />
                    </Button>
                  }
                  title={t('deleteTitle')}
                  confirmLabel={tc('delete')}
                  cancelLabel={tc('cancel')}
                  onConfirm={async () => {
                    try {
                      await api.del(`/trees/${treeId}/stories/${s.id}`);
                      await qc.invalidateQueries({ queryKey: ['tree', treeId, 'stories'] });
                    } catch {
                      toast.error(tc('error'));
                    }
                  }}
                />
              )}
            </div>
            {s.media?.url && <audio src={s.media.url} controls preload="none" className="w-full" />}
            {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
            {s.body && <p className="text-sm whitespace-pre-line">{s.body}</p>}
          </li>
        );
      })}
    </ul>
  );
}
