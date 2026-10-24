'use client';
import * as React from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Expand, Info, LocateFixed, Maximize, Search, TreePine } from 'lucide-react';
import { buildLayoutGraph, FamilyIndex, lifeSpanLabel, type FocusMode, type LayoutGraph } from '@super-project/genealogy';
import type { RelativeKind, TreeGraph } from '@super-project/types';
import { useApi } from '@/lib/api';
import { qk, useGraph, useInvalidatingMutation } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, Popover, PopoverAnchor, PopoverContent, PopoverTrigger, Spinner, Tooltip } from '@/components/ui/misc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AddRelativeDialog, type AddRelativeTarget } from './add-relative-dialog';
import { computeLayout, PERSON_H, PERSON_W, type Positions } from './elk-layout';
import { CanvasActionsContext, nodeTypes, type CanvasActions } from './nodes';
import { PersonPanel } from './person-panel';
import { useTreeContext } from './tree-context';

export function TreeCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}

function CanvasInner() {
  const tree = useTreeContext();
  const t = useTranslations('canvas');
  const graph = useGraph(tree.id);

  if (graph.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (graph.isError || !graph.data) return <EmptyState className="m-6" title={t('loadError')} />;
  if (!graph.data.persons.length) return <FirstPerson />;
  return <Canvas graph={graph.data} />;
}

function Canvas({ graph }: { graph: TreeGraph }) {
  const tree = useTreeContext();
  const t = useTranslations('canvas');
  const flow = useReactFlow();
  const index = React.useMemo(() => new FamilyIndex(graph), [graph]);

  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());
  const [focus, setFocus] = React.useState<{ id: string | null; mode: FocusMode }>({ id: null, mode: 'all' });
  const [selected, setSelected] = React.useState<string | null>(null);
  const [addTarget, setAddTarget] = React.useState<AddRelativeTarget | null>(null);
  const [positions, setPositions] = React.useState<Positions | null>(null);
  const [layouting, setLayouting] = React.useState(false);
  const pendingCenter = React.useRef<string | null>(null);
  const didFit = React.useRef(false);

  const layoutGraph: LayoutGraph = React.useMemo(
    () => buildLayoutGraph(graph, { collapsed, focusId: focus.id, focusMode: focus.mode }, index),
    [graph, collapsed, focus, index],
  );

  React.useEffect(() => {
    let cancelled = false;
    setLayouting(true);
    computeLayout(layoutGraph)
      .then((pos) => {
        if (!cancelled) setPositions(pos);
      })
      .catch(() => toast.error(t('layoutError')))
      .finally(() => !cancelled && setLayouting(false));
    return () => {
      cancelled = true;
    };
  }, [layoutGraph, t]);

  const nodes: Node[] = React.useMemo(() => {
    if (!positions) return [];
    return layoutGraph.nodes.flatMap((n) => {
      const pos = positions.get(n.id);
      if (!pos) return [];
      return [
        {
          id: n.id,
          type: n.data.kind,
          position: pos,
          data: n.data as unknown as Record<string, unknown>,
          selected: n.id === selected,
          selectable: n.data.kind === 'person',
          focusable: n.data.kind === 'person',
          ariaLabel: n.data.kind === 'person' ? n.data.person.givenName : undefined,
        },
      ];
    });
  }, [layoutGraph, positions, selected]);

  const edges: Edge[] = React.useMemo(
    () =>
      layoutGraph.edges.map((e) => {
        const dashed = e.kind === 'child' && (e.linkType === 'adoptive' || e.linkType === 'unknown');
        const dotted = e.kind === 'child' && (e.linkType === 'step' || e.linkType === 'foster');
        const ended = e.kind === 'partner' && (e.status === 'divorced' || e.status === 'widowed');
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'smoothstep',
          selectable: false,
          focusable: false,
          style: {
            strokeWidth: e.kind === 'partner' ? 2 : 1.5,
            stroke: e.kind === 'partner' ? 'var(--gold)' : undefined,
            strokeDasharray: dashed || ended ? '6 4' : dotted ? '2 4' : undefined,
            opacity: ended ? 0.6 : 1,
          },
        };
      }),
    [layoutGraph],
  );

  const centerOn = React.useCallback(
    (id: string, zoom = 1) => {
      const pos = positions?.get(id);
      if (!pos) {
        pendingCenter.current = id;
        return;
      }
      void flow.setCenter(pos.x + PERSON_W / 2, pos.y + PERSON_H / 2, { zoom, duration: 450 });
    },
    [positions, flow],
  );

  // first layout: center on the viewer / tree root, or fit everything
  React.useEffect(() => {
    if (!positions) return;
    if (pendingCenter.current && positions.has(pendingCenter.current)) {
      const id = pendingCenter.current;
      pendingCenter.current = null;
      centerOn(id);
      return;
    }
    if (didFit.current) return;
    didFit.current = true;
    const start = tree.access.personId ?? tree.rootPersonId;
    if (start && positions.has(start) && graph.persons.length > 25) centerOn(start, 0.9);
    else void flow.fitView({ padding: 0.15, duration: 300 });
  }, [positions, centerOn, flow, tree.access.personId, tree.rootPersonId, graph.persons.length]);

  const actions: CanvasActions = React.useMemo(
    () => ({
      canEdit: tree.access.canEdit,
      viewerPersonId: tree.access.personId,
      onAddRelative: (personId: string, relation: RelativeKind) => setAddTarget({ personId, relation }),
      onToggleCollapse: (id: string) =>
        setCollapsed((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
    }),
    [tree.access.canEdit, tree.access.personId],
  );

  const select = (id: string) => {
    // make sure the person is visible: clear focus/collapse that hides them
    if (!layoutGraph.nodes.some((n) => n.id === id)) {
      setFocus({ id: null, mode: 'all' });
      setCollapsed(new Set());
    }
    setSelected(id);
    centerOn(id);
  };

  return (
    <CanvasActionsContext.Provider value={actions}>
      <div className="relative min-h-0 flex-1" role="application" aria-label={t('ariaCanvas')}>
        <div className="absolute inset-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          onlyRenderVisibleElements
          minZoom={0.03}
          maxZoom={2}
          onNodeClick={(_, n) => n.type === 'person' && setSelected(n.id)}
          onPaneClick={() => setSelected(null)}
          fitView={false}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
          <Controls showInteractive={false} position="bottom-left" />
          <MiniMap
            pannable
            zoomable
            className="!hidden sm:!block"
            nodeColor={(n) => {
              const d = n.data as { kind?: string; person?: { gender: string; isLiving: boolean } };
              if (d.kind !== 'person' || !d.person) return 'var(--gold)';
              if (!d.person.isLiving) return 'var(--muted-foreground)';
              return d.person.gender === 'female' ? 'var(--primary)' : 'var(--blue)';
            }}
          />
        </ReactFlow>
        </div>

        <Toolbar
          index={index}
          focus={focus}
          selected={selected}
          collapsedCount={collapsed.size}
          onSearchSelect={select}
          onFocusMode={(mode) => setFocus({ id: mode === 'all' ? null : (selected ?? focus.id ?? tree.access.personId ?? tree.rootPersonId), mode })}
          onFit={() => void flow.fitView({ padding: 0.15, duration: 400 })}
          onMe={tree.access.personId ? () => select(tree.access.personId as string) : undefined}
          onExpandAll={() => {
            setCollapsed(new Set());
            setFocus({ id: null, mode: 'all' });
          }}
        />
        {layouting && (
          <div className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-card p-2 shadow">
            <Spinner className="size-4" />
          </div>
        )}
      </div>

      <PersonPanel
        index={index}
        personId={selected}
        onClose={() => setSelected(null)}
        onSelect={select}
        onAddRelative={(id, r) => setAddTarget({ personId: id, relation: r })}
        onCenter={(id) => centerOn(id)}
        onFocus={(id, mode) => {
          setFocus({ id, mode });
          pendingCenter.current = id;
        }}
      />
      <AddRelativeDialog
        treeId={tree.id}
        index={index}
        target={addTarget}
        onClose={() => setAddTarget(null)}
        onCreated={(id) => {
          pendingCenter.current = id;
          setSelected(id);
          // a new descendant of a collapsed person should be visible
          setCollapsed((prev) => (prev.size ? new Set() : prev));
        }}
      />
    </CanvasActionsContext.Provider>
  );
}

function Toolbar({
  index,
  focus,
  selected,
  collapsedCount,
  onSearchSelect,
  onFocusMode,
  onFit,
  onMe,
  onExpandAll,
}: {
  index: FamilyIndex;
  focus: { id: string | null; mode: FocusMode };
  selected: string | null;
  collapsedCount: number;
  onSearchSelect: (id: string) => void;
  onFocusMode: (m: FocusMode) => void;
  onFit: () => void;
  onMe?: () => void;
  onExpandAll: () => void;
}) {
  const t = useTranslations('canvas');
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const results = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return [...index.persons.values()].filter((p) => `${p.givenName} ${p.patronymic ?? ''} ${p.clanName ?? ''}`.toLowerCase().includes(s)).slice(0, 12);
  }, [q, index]);
  const focusName = focus.id ? index.get(focus.id)?.givenName : null;

  return (
    <div className="pointer-events-none absolute inset-x-2 top-2 flex flex-wrap items-start gap-2 sm:inset-x-3 sm:top-3">
      <Popover open={open && results.length > 0} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <form
            role="search"
            className="pointer-events-auto relative w-full max-w-64 sm:w-64"
            onSubmit={(e) => {
              e.preventDefault();
              if (results[0]) {
                onSearchSelect(results[0].id);
                setOpen(false);
              }
            }}
          >
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder={t('search')}
              aria-label={t('search')}
              className="bg-card pl-9 shadow-sm"
            />
          </form>
        </PopoverAnchor>
        <PopoverContent className="w-64 p-1" onOpenAutoFocus={(e) => e.preventDefault()}>
          <ul role="listbox" aria-label={t('search')}>
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    onSearchSelect(p.id);
                    setOpen(false);
                  }}
                >
                  <span className="truncate">
                    {p.givenName} <span className="text-muted-foreground">{p.patronymic}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{lifeSpanLabel(p.birthDate, p.deathDate, p.isLiving)}</span>
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>

      <div className="pointer-events-auto flex items-center gap-1 rounded-lg border bg-card p-1 shadow-sm">
        <Label htmlFor="focus-mode" className="sr-only">
          {t('view')}
        </Label>
        <Select value={focus.mode} onValueChange={(v) => onFocusMode(v as FocusMode)}>
          <SelectTrigger id="focus-mode" className="h-8 w-auto min-w-36 border-0 shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('focus.all')}</SelectItem>
            <SelectItem value="ancestors" disabled={!selected && !focus.id}>
              {t('focus.ancestors')}
            </SelectItem>
            <SelectItem value="descendants" disabled={!selected && !focus.id}>
              {t('focus.descendants')}
            </SelectItem>
            <SelectItem value="family" disabled={!selected && !focus.id}>
              {t('focus.family')}
            </SelectItem>
          </SelectContent>
        </Select>
        {focusName && focus.mode !== 'all' && (
          <span className="hidden max-w-28 truncate px-1 text-xs text-muted-foreground sm:inline">{focusName}</span>
        )}
        <Tooltip content={t('fit')}>
          <Button size="icon-sm" variant="ghost" onClick={onFit} aria-label={t('fit')}>
            <Maximize />
          </Button>
        </Tooltip>
        {onMe && (
          <Tooltip content={t('me')}>
            <Button size="icon-sm" variant="ghost" onClick={onMe} aria-label={t('me')}>
              <LocateFixed />
            </Button>
          </Tooltip>
        )}
        {(collapsedCount > 0 || focus.mode !== 'all') && (
          <Tooltip content={t('showAll')}>
            <Button size="icon-sm" variant="ghost" onClick={onExpandAll} aria-label={t('showAll')}>
              <Expand />
            </Button>
          </Tooltip>
        )}
        <Legend />
      </div>
    </div>
  );
}

function Legend() {
  const t = useTranslations('canvas.legend');
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={t('title')}>
          <Info />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-2 text-sm">
        <p className="font-medium">{t('title')}</p>
        <LegendRow swatch={<span className="h-0.5 w-8 bg-foreground/50" />} label={t('biological')} />
        <LegendRow swatch={<span className="w-8 border-t-2 border-dashed border-foreground/50" />} label={t('adoptive')} />
        <LegendRow swatch={<span className="w-8 border-t-2 border-dotted border-foreground/50" />} label={t('step')} />
        <LegendRow swatch={<span className="size-3 rounded-full bg-gold" />} label={t('union')} />
        <LegendRow swatch={<span className="size-3 rounded-full border-2 border-dashed border-muted-foreground" />} label={t('ended')} />
        <LegendRow swatch={<span className="text-muted-foreground">†</span>} label={t('deceased')} />
      </PopoverContent>
    </Popover>
  );
}

function LegendRow({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex w-8 justify-center">{swatch}</span>
      <span>{label}</span>
    </div>
  );
}

/** Empty tree: create the first person. */
function FirstPerson() {
  const tree = useTreeContext();
  const t = useTranslations('canvas');
  const tc = useTranslations('common');
  const api = useApi();
  const [name, setName] = React.useState('');
  const create = useInvalidatingMutation((givenName: string) => api.post(`/trees/${tree.id}/persons`, { givenName }), [qk.graph(tree.id), qk.tree(tree.id)]);
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <EmptyState
        icon={<TreePine />}
        title={t('emptyTitle')}
        description={tree.access.canEdit ? t('emptyText') : t('emptyViewer')}
        action={
          tree.access.canEdit ? (
            <form
              className="flex w-full max-w-sm gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!name.trim()) return;
                try {
                  await create.mutateAsync(name.trim());
                } catch {
                  toast.error(tc('error'));
                }
              }}
            >
              <Input aria-label={t('firstName')} placeholder={t('firstName')} value={name} onChange={(e) => setName(e.target.value)} />
              <Button type="submit" disabled={create.isPending}>
                {tc('add')}
              </Button>
            </form>
          ) : undefined
        }
      />
    </div>
  );
}
