import type { ParentLinkType, PartnershipStatus, PersonSummary, TreeGraph } from '@super-project/types';
import { FamilyIndex } from './graph';

/**
 * Renderer-agnostic family graph: person nodes plus small "union" nodes that sit
 * between partners and their shared children. The web app feeds this into elkjs
 * and React Flow; keeping it pure makes it testable.
 */
export type FocusMode = 'all' | 'ancestors' | 'descendants' | 'family';

export interface LayoutOptions {
  collapsed?: ReadonlySet<string>;
  focusId?: string | null;
  focusMode?: FocusMode;
}

export interface PersonNodeData {
  kind: 'person';
  person: PersonSummary;
  collapsed: boolean;
  /** how many descendants are hidden because this node is collapsed */
  hiddenCount: number;
  hasChildren: boolean;
  hasParents: boolean;
}

export interface UnionNodeData {
  kind: 'union';
  partnershipId: string | null;
  status: PartnershipStatus | 'implicit';
  partners: [string, string];
}

export interface LayoutNode {
  id: string;
  data: PersonNodeData | UnionNodeData;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  kind: 'partner' | 'child';
  linkType?: ParentLinkType;
  status?: PartnershipStatus | 'implicit';
}

export interface LayoutGraph {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
}

export function unionId(a: string, b: string, partnershipId?: string | null): string {
  return partnershipId ? `u:${partnershipId}` : `u:${[a, b].sort().join('|')}`;
}

export function visiblePersonIds(idx: FamilyIndex, opts: LayoutOptions = {}): Set<string> {
  const all = [...idx.persons.keys()];
  let visible: Set<string>;
  const focus = opts.focusId && idx.get(opts.focusId) ? opts.focusId : null;
  const mode = focus ? (opts.focusMode ?? 'all') : 'all';

  if (mode === 'all' || !focus) {
    visible = new Set(all);
  } else {
    visible = new Set([focus]);
    const addPartners = (ids: Iterable<string>) => {
      for (const id of [...ids]) for (const p of idx.partners(id)) visible.add(p);
    };
    if (mode === 'ancestors' || mode === 'family') for (const a of idx.ancestors(focus)) visible.add(a);
    if (mode === 'descendants' || mode === 'family') {
      const desc = idx.descendants(focus);
      for (const d of desc) visible.add(d);
      addPartners([focus, ...desc]);
    }
    if (mode === 'family') {
      for (const p of idx.parents(focus)) for (const c of idx.children(p.id)) visible.add(c.id);
      addPartners([focus]);
    }
  }

  for (const c of opts.collapsed ?? []) {
    if (!visible.has(c)) continue;
    for (const d of idx.descendants(c)) visible.delete(d);
  }
  // drop partners who were only reachable through hidden people
  if (opts.collapsed?.size) {
    for (const id of [...visible]) {
      const anchored =
        idx.parents(id).some((p) => visible.has(p.id)) ||
        idx.children(id).some((c) => visible.has(c.id)) ||
        idx.parents(id).length === 0;
      const partnerVisible = idx.partners(id).some((p) => visible.has(p));
      if (!anchored && !partnerVisible) visible.delete(id);
    }
  }
  return visible;
}

export function buildLayoutGraph(graph: TreeGraph, opts: LayoutOptions = {}, index?: FamilyIndex): LayoutGraph {
  const idx = index ?? new FamilyIndex(graph);
  const visible = visiblePersonIds(idx, opts);
  const collapsed = opts.collapsed ?? new Set<string>();
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  const unions = new Map<string, UnionNodeData>();

  for (const p of graph.persons) {
    if (!visible.has(p.id)) continue;
    const isCollapsed = collapsed.has(p.id);
    nodes.push({
      id: p.id,
      data: {
        kind: 'person',
        person: p,
        collapsed: isCollapsed,
        hiddenCount: isCollapsed ? [...idx.descendants(p.id)].filter((d) => !visible.has(d)).length : 0,
        hasChildren: idx.children(p.id).length > 0,
        hasParents: idx.parents(p.id).length > 0,
      },
    });
  }

  const ensureUnion = (a: string, b: string, partnershipId: string | null, status: UnionNodeData['status']) => {
    const id = unionId(a, b, partnershipId);
    if (!unions.has(id)) {
      unions.set(id, { kind: 'union', partnershipId, status, partners: [a, b] });
      edges.push({ id: `${id}:${a}`, source: a, target: id, kind: 'partner', status });
      edges.push({ id: `${id}:${b}`, source: b, target: id, kind: 'partner', status });
    }
    return id;
  };

  const partnerships = [...graph.partnerships].sort((x, y) => x.sortOrder - y.sortOrder);
  for (const pt of partnerships) {
    if (visible.has(pt.person1Id) && visible.has(pt.person2Id)) {
      ensureUnion(pt.person1Id, pt.person2Id, pt.id, pt.status);
    }
  }

  for (const p of graph.persons) {
    if (!visible.has(p.id)) continue;
    const parents = idx.parents(p.id).filter((r) => visible.has(r.id));
    if (parents.length === 0) continue;
    // pick the pair of parents that form a partnership (prefer lineage links)
    let paired = false;
    for (let i = 0; i < parents.length && !paired; i++) {
      for (let j = i + 1; j < parents.length && !paired; j++) {
        const a = parents[i];
        const b = parents[j];
        const pt = idx.partnershipBetween(a.id, b.id);
        const uid = ensureUnion(a.id, b.id, pt?.id ?? null, pt?.status ?? 'implicit');
        const type = a.type === b.type ? a.type : a.type === 'biological' ? b.type : a.type;
        edges.push({ id: `${uid}>${p.id}`, source: uid, target: p.id, kind: 'child', linkType: type });
        const rest = parents.filter((r) => r !== a && r !== b);
        for (const r of rest) {
          edges.push({ id: `${r.id}>${p.id}`, source: r.id, target: p.id, kind: 'child', linkType: r.type });
        }
        paired = true;
      }
    }
    if (!paired) {
      const only = parents[0];
      edges.push({ id: `${only.id}>${p.id}`, source: only.id, target: p.id, kind: 'child', linkType: only.type });
    }
  }

  for (const [id, data] of unions) nodes.push({ id, data });
  return { nodes, edges };
}
