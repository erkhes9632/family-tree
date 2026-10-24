import type { ParentChildLink, ParentLinkType, PartnershipDto, PersonSummary, TreeGraph } from '@super-project/types';
import { comparePartialDates } from './dates';

/** Link types that make someone part of the lineage (used for blood/kin derivation). */
const LINEAGE_TYPES: ReadonlySet<ParentLinkType> = new Set(['biological', 'adoptive', 'unknown']);

export interface ParentRef {
  id: string;
  type: ParentLinkType;
}

export interface Siblings {
  /** share both lineage parents */
  full: string[];
  /** share exactly one lineage parent */
  half: string[];
  /** related only through a parent's partner or a step/foster link */
  step: string[];
}

/** Read-only index over a tree's people and relationships. */
export class FamilyIndex {
  readonly persons = new Map<string, PersonSummary>();
  private readonly parentsMap = new Map<string, ParentRef[]>();
  private readonly childrenMap = new Map<string, ParentRef[]>();
  private readonly partnersMap = new Map<string, PartnershipDto[]>();

  constructor(graph: TreeGraph) {
    for (const p of graph.persons) this.persons.set(p.id, p);
    for (const l of graph.parentChild) this.addLink(l);
    for (const pt of graph.partnerships) {
      push(this.partnersMap, pt.person1Id, pt);
      push(this.partnersMap, pt.person2Id, pt);
    }
    for (const list of this.partnersMap.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  private addLink(l: ParentChildLink) {
    push(this.parentsMap, l.childId, { id: l.parentId, type: l.type });
    push(this.childrenMap, l.parentId, { id: l.childId, type: l.type });
  }

  get(id: string): PersonSummary | undefined {
    return this.persons.get(id);
  }

  parents(id: string): ParentRef[] {
    return this.parentsMap.get(id) ?? [];
  }

  /** Lineage parents only (biological / adoptive / unknown). */
  lineageParents(id: string): string[] {
    return this.parents(id)
      .filter((p) => LINEAGE_TYPES.has(p.type))
      .map((p) => p.id);
  }

  children(id: string): ParentRef[] {
    return this.childrenMap.get(id) ?? [];
  }

  lineageChildren(id: string): string[] {
    return this.children(id)
      .filter((c) => LINEAGE_TYPES.has(c.type))
      .map((c) => c.id);
  }

  partnerships(id: string): PartnershipDto[] {
    return this.partnersMap.get(id) ?? [];
  }

  partners(id: string): string[] {
    return this.partnerships(id).map((p) => (p.person1Id === id ? p.person2Id : p.person1Id));
  }

  partnershipBetween(a: string, b: string): PartnershipDto | undefined {
    return this.partnerships(a).find((p) => p.person1Id === b || p.person2Id === b);
  }

  father(id: string): string | undefined {
    return this.lineageParents(id).find((p) => this.get(p)?.gender === 'male');
  }

  mother(id: string): string | undefined {
    return this.lineageParents(id).find((p) => this.get(p)?.gender === 'female');
  }

  siblings(id: string): Siblings {
    const mine = new Set(this.lineageParents(id));
    const full: string[] = [];
    const half: string[] = [];
    const step = new Set<string>();
    const candidates = new Set<string>();
    for (const p of mine) for (const c of this.lineageChildren(p)) if (c !== id) candidates.add(c);
    for (const c of candidates) {
      const theirs = new Set(this.lineageParents(c));
      const shared = [...mine].filter((p) => theirs.has(p)).length;
      if (shared >= 2 || (shared === 1 && mine.size === 1 && theirs.size === 1)) full.push(c);
      else if (shared >= 1) half.push(c);
    }
    // step: children of my parents' partners (who are not my parents), and kids linked via step/foster
    const allMyParents = this.parents(id).map((p) => p.id);
    for (const parent of allMyParents) {
      for (const partner of this.partners(parent)) {
        if (mine.has(partner)) continue;
        for (const c of this.children(partner)) {
          if (c.id !== id && !full.includes(c.id) && !half.includes(c.id)) step.add(c.id);
        }
      }
      for (const c of this.children(parent)) {
        if (c.id !== id && !LINEAGE_TYPES.has(c.type) && !full.includes(c.id) && !half.includes(c.id)) step.add(c.id);
      }
    }
    for (const p of this.parents(id)) {
      if (LINEAGE_TYPES.has(p.type)) continue;
      for (const c of this.children(p.id)) if (c.id !== id && !full.includes(c.id) && !half.includes(c.id)) step.add(c.id);
    }
    const byAge = (a: string, b: string) => comparePartialDates(this.get(a)?.birthDate, this.get(b)?.birthDate);
    return { full: full.sort(byAge), half: half.sort(byAge), step: [...step].sort(byAge) };
  }

  /** Ancestors with generation distance (self = 0), lineage links only. */
  ancestorDepths(id: string): Map<string, number> {
    const out = new Map<string, number>([[id, 0]]);
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift() as string;
      const d = out.get(cur) as number;
      for (const p of this.lineageParents(cur)) {
        if (!out.has(p)) {
          out.set(p, d + 1);
          queue.push(p);
        }
      }
    }
    return out;
  }

  /** All descendants via any parent link type. */
  descendants(id: string): Set<string> {
    const out = new Set<string>();
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop() as string;
      for (const c of this.children(cur)) {
        if (!out.has(c.id) && c.id !== id) {
          out.add(c.id);
          stack.push(c.id);
        }
      }
    }
    return out;
  }

  ancestors(id: string): Set<string> {
    const out = new Set<string>();
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop() as string;
      for (const p of this.parents(cur)) {
        if (!out.has(p.id) && p.id !== id) {
          out.add(p.id);
          stack.push(p.id);
        }
      }
    }
    return out;
  }

  /** Would linking parent→child create a cycle? */
  wouldCreateCycle(parentId: string, childId: string): boolean {
    return parentId === childId || this.descendants(childId).has(parentId);
  }

  /** Generation number per person (0 = oldest), for timeline grouping and "nine generations". */
  generations(): Map<string, number> {
    const gen = new Map<string, number>();
    const roots = [...this.persons.keys()].filter((id) => this.parents(id).length === 0);
    const visit = (id: string, g: number, seen: Set<string>) => {
      if (seen.has(id)) return;
      if ((gen.get(id) ?? -1) >= g) return;
      gen.set(id, g);
      seen.add(id);
      for (const c of this.children(id)) visit(c.id, g + 1, seen);
      seen.delete(id);
    };
    for (const r of roots) visit(r, 0, new Set());
    // align partners to the same generation
    for (const [id, g] of gen) {
      for (const p of this.partners(id)) {
        if (!this.parents(p).length && (gen.get(p) ?? 0) < g) gen.set(p, g);
      }
    }
    return gen;
  }
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
}
