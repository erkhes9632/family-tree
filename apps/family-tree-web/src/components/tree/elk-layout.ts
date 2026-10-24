'use client';
import type { ELK, ElkNode } from 'elkjs/lib/elk-api';
import type { LayoutGraph } from '@super-project/genealogy';

export const PERSON_W = 196;
export const PERSON_H = 76;
export const UNION_SIZE = 12;

let elkPromise: Promise<ELK> | null = null;

/** elk in a Web Worker (worker script copied to /public at build); falls back to the main thread. */
function getElk(): Promise<ELK> {
  if (!elkPromise) {
    elkPromise = (async () => {
      if (typeof Worker !== 'undefined') {
        try {
          const { default: ELKApi } = await import('elkjs/lib/elk-api.js');
          return new ELKApi({ workerUrl: '/elk-worker.min.js' }) as ELK;
        } catch {
          /* fall through */
        }
      }
      const { default: ELKBundled } = await import('elkjs/lib/elk.bundled.js');
      return new ELKBundled() as ELK;
    })();
  }
  return elkPromise;
}

export type Positions = Map<string, { x: number; y: number }>;

export async function computeLayout(graph: LayoutGraph): Promise<Positions> {
  const elk = await getElk();
  const root: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.layered.spacing.nodeNodeBetweenLayers': '36',
      'elk.spacing.nodeNode': '28',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.crossingMinimization.semiInteractive': 'false',
      'elk.separateConnectedComponents': 'true',
      'elk.spacing.componentComponent': '80',
    },
    children: graph.nodes.map((n) =>
      n.data.kind === 'person' ? { id: n.id, width: PERSON_W, height: PERSON_H } : { id: n.id, width: UNION_SIZE, height: UNION_SIZE },
    ),
    edges: graph.edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  };
  let res: ElkNode;
  try {
    res = await elk.layout(root);
  } catch (err) {
    // worker failed to load (e.g. blocked) → retry once on the main thread
    const { default: ELKBundled } = await import('elkjs/lib/elk.bundled.js');
    elkPromise = Promise.resolve(new ELKBundled() as ELK);
    res = await (await elkPromise).layout(root);
    console.warn('elk worker unavailable, used main thread', err);
  }
  const out: Positions = new Map();
  for (const c of res.children ?? []) out.set(c.id, { x: c.x ?? 0, y: c.y ?? 0 });
  return out;
}
