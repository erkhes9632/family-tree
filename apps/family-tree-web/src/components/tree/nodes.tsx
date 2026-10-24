'use client';
import * as React from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, Plus, UserRound } from 'lucide-react';
import { lifeSpanLabel, type PersonNodeData, type UnionNodeData } from '@super-project/genealogy';
import type { RelativeKind } from '@super-project/types';
import { RELATIVE_KINDS } from '@super-project/types';
import { cn, initials } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PERSON_H, PERSON_W, UNION_SIZE } from './elk-layout';

export type PersonFlowNode = Node<PersonNodeData & Record<string, unknown>, 'person'>;
export type UnionFlowNode = Node<UnionNodeData & Record<string, unknown>, 'union'>;

export interface CanvasActions {
  canEdit: boolean;
  viewerPersonId: string | null;
  onAddRelative: (personId: string, relation: RelativeKind) => void;
  onToggleCollapse: (personId: string) => void;
}
export const CanvasActionsContext = React.createContext<CanvasActions | null>(null);

const hidden = '!h-1 !w-1 !min-h-0 !min-w-0 !border-0 !bg-transparent';

export const PersonNode = React.memo(function PersonNode({ id, data, selected }: NodeProps<PersonFlowNode>) {
  const actions = React.useContext(CanvasActionsContext);
  const t = useTranslations('canvas');
  const tr = useTranslations('relation');
  const locale = useLocale();
  const p = data.person;
  const deceased = !p.isLiving;
  const years = lifeSpanLabel(p.birthDate, p.deathDate, p.isLiving);
  const isMe = actions?.viewerPersonId === id;
  const tone = deceased ? 'bg-node-deceased' : p.gender === 'male' ? 'bg-node-male' : p.gender === 'female' ? 'bg-node-female' : 'bg-node-other';
  const label = [p.givenName, p.patronymic, years].filter(Boolean).join(', ');

  return (
    <div
      style={{ width: PERSON_W, height: PERSON_H }}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-xl border px-2.5 shadow-sm transition-shadow',
        tone,
        selected ? 'border-primary ring-2 ring-primary/60 shadow-md' : 'border-border hover:shadow-md',
        isMe && 'outline-2 outline-offset-2 outline-gold',
      )}
      aria-label={label}
      lang={locale}
    >
      <Handle type="target" position={Position.Top} className={hidden} isConnectable={false} />
      <div className={cn('relative size-12 shrink-0 overflow-hidden rounded-full border-2 border-card bg-muted', deceased && 'grayscale')}>
        {p.photoUrl ? (
           
          <img src={p.photoUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-sm font-semibold text-muted-foreground">{initials(p.givenName)}</span>
        )}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className={cn('truncate text-[0.95rem] font-semibold', deceased && 'text-foreground/80')}>
          {p.givenName}
          {deceased && (
            <span className="ml-1 text-muted-foreground" aria-label={t('deceased')} title={t('deceased')}>
              †
            </span>
          )}
        </p>
        {p.patronymic && <p className="truncate text-xs text-muted-foreground">{p.patronymic}</p>}
        <p className="truncate text-xs text-muted-foreground tabular-nums">{years || ' '}</p>
      </div>
      {p.userId && (
        <span className="absolute top-1.5 right-1.5 text-blue" title={t('hasAccount')}>
          <UserRound className="size-3.5" aria-label={t('hasAccount')} />
        </span>
      )}

      {data.hasChildren && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            actions?.onToggleCollapse(id);
          }}
          className={cn(
            'nodrag absolute -bottom-3 left-1/2 flex h-6 min-w-6 -translate-x-1/2 items-center justify-center gap-0.5 rounded-full border bg-card px-1.5 text-[0.7rem] font-medium shadow-sm transition-opacity hover:bg-muted',
            !data.collapsed && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
            selected && 'opacity-100',
          )}
          aria-label={data.collapsed ? t('expand') : t('collapse')}
          title={data.collapsed ? t('expand') : t('collapse')}
        >
          {data.collapsed ? (
            <>
              <ChevronDown className="size-3" />
              {data.hiddenCount > 0 && `+${data.hiddenCount}`}
            </>
          ) : (
            <ChevronUp className="size-3" />
          )}
        </button>
      )}

      {actions?.canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'nodrag absolute top-1/2 -right-3 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border bg-primary text-primary-foreground shadow transition-opacity',
                selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
              )}
              aria-label={t('addRelativeTo', { name: p.givenName })}
            >
              <Plus className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right">
            <DropdownMenuLabel>{t('addRelative')}</DropdownMenuLabel>
            {RELATIVE_KINDS.map((r) => (
              <DropdownMenuItem key={r} onSelect={() => actions.onAddRelative(id, r)}>
                <Plus /> {tr(r)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Handle type="source" position={Position.Bottom} className={hidden} isConnectable={false} />
    </div>
  );
});

export const UnionNode = React.memo(function UnionNode({ data }: NodeProps<UnionFlowNode>) {
  const t = useTranslations('partnership');
  const ended = data.status === 'divorced' || data.status === 'widowed';
  return (
    <div
      style={{ width: UNION_SIZE, height: UNION_SIZE }}
      className={cn('rounded-full border-2', ended ? 'border-dashed border-muted-foreground bg-card' : data.status === 'implicit' ? 'border-muted-foreground/50 bg-muted' : 'border-gold bg-gold')}
      title={t(data.status)}
    >
      <Handle type="target" position={Position.Top} className={hidden} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} className={hidden} isConnectable={false} />
    </div>
  );
});

export const nodeTypes = { person: PersonNode, union: UnionNode };
