import { sampleFamily, tree } from './fixtures';
import { buildLayoutGraph, type UnionNodeData } from './layout';

describe('buildLayoutGraph', () => {
  const g = sampleFamily().graph;

  it('creates one union node per visible partnership and routes shared children through it', () => {
    const { nodes, edges } = buildLayoutGraph(g);
    const persons = nodes.filter((n) => n.data.kind === 'person');
    const unions = nodes.filter((n) => n.data.kind === 'union');
    expect(persons).toHaveLength(g.persons.length);
    // every partnership + one implicit union for wife's parents (no partnership recorded)
    expect(unions).toHaveLength(g.partnerships.length + 1);
    // me has both parents, who are (ex-)partners → edge from their union
    expect(edges.find((e) => e.target === 'me')?.source).toBe('u:dad+mom');
    // uncleM's child has a single parent → direct edge
    expect(edges.find((e) => e.target === 'cousinM')?.source).toBe('uncleM');
    // dad is connected to both of his partnerships
    expect(edges.filter((e) => e.source === 'dad' && e.kind === 'partner')).toHaveLength(2);
  });

  it('creates an implicit union for co-parents without a partnership', () => {
    const t = tree().person('a', 'male').person('b', 'female').person('c', 'male').child('a', 'c').child('b', 'c');
    const { nodes, edges } = buildLayoutGraph(t.graph);
    const u = nodes.find((n) => n.data.kind === 'union');
    expect((u?.data as UnionNodeData).status).toBe('implicit');
    expect(edges.filter((e) => e.kind === 'child')).toHaveLength(1);
  });

  it('keeps the link type on child edges', () => {
    const t = tree().person('a', 'male').person('c', 'male').child('a', 'c', 'adoptive');
    expect(buildLayoutGraph(t.graph).edges[0].linkType).toBe('adoptive');
  });

  it('hides descendants of collapsed people and counts them', () => {
    const { nodes } = buildLayoutGraph(g, { collapsed: new Set(['me']) });
    const ids = new Set(nodes.map((n) => n.id));
    expect(ids.has('son')).toBe(false);
    expect(ids.has('grandson')).toBe(false);
    // still anchored through her own (visible) father
    expect(ids.has('daughterInLaw')).toBe(true);
    expect(ids.has('wife')).toBe(true);
    const me = nodes.find((n) => n.id === 'me');
    expect(me?.data.kind === 'person' && me.data.hiddenCount).toBe(2);
  });

  it('focus on ancestors only shows the direct line', () => {
    const { nodes } = buildLayoutGraph(g, { focusId: 'me', focusMode: 'ancestors' });
    const ids = nodes.filter((n) => n.data.kind === 'person').map((n) => n.id).sort();
    expect(ids).toEqual(['dad', 'gf', 'gm', 'me', 'mgf', 'mgm', 'mom']);
  });

  it('handles a 400-person tree quickly', () => {
    const t = tree();
    t.person('p0', 'male', 1800);
    let n = 1;
    for (let i = 0; n < 400; i++) {
      for (let k = 0; k < 2 && n < 400; k++, n++) {
        t.person(`p${n}`, n % 2 ? 'male' : 'female', 1800 + n).child(`p${i}`, `p${n}`);
      }
    }
    const start = Date.now();
    const out = buildLayoutGraph(t.graph);
    expect(out.nodes.length).toBe(400);
    expect(Date.now() - start).toBeLessThan(500);
  });
});
