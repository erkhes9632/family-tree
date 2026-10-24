'use client';
import { useTranslations } from 'next-intl';
import { Users } from 'lucide-react';
import type { TreeDto, TreeRole } from '@super-project/types';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { PRIVACY_ICONS } from './create-tree-dialog';

export function TreeCard({ tree, role }: { tree: TreeDto; role?: TreeRole }) {
  const tp = useTranslations('privacy');
  const tr = useTranslations('roles');
  const t = useTranslations('dashboard');
  const Icon = PRIVACY_ICONS[tree.privacy];
  return (
    <Link href={`/trees/${tree.id}`} className="group flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg leading-snug font-semibold group-hover:text-primary">{tree.name}</h3>
        {role && <Badge variant={role === 'admin' ? 'default' : 'secondary'}>{tr(role)}</Badge>}
      </div>
      {tree.description && <p className="line-clamp-2 text-sm text-muted-foreground">{tree.description}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Icon className="size-3.5" /> {tp(`${tree.privacy}.label`)}
        </span>
        <span className="flex items-center gap-1">
          <Users className="size-3.5" /> {t('people', { n: tree.personCount ?? 0 })}
        </span>
      </div>
    </Link>
  );
}
