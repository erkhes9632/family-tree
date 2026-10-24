'use client';
import dynamic from 'next/dynamic';
import { Spinner } from '@/components/ui/misc';

// The canvas (React Flow + elkjs) is browser-only; keeping it out of the server bundle keeps the Worker small.
const TreeCanvas = dynamic(() => import('@/components/tree/tree-canvas').then((m) => m.TreeCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center">
      <Spinner />
    </div>
  ),
});

export default function TreePage() {
  return <TreeCanvas />;
}
