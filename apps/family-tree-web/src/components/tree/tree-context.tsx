'use client';
import * as React from 'react';
import type { TreeWithAccess } from '@super-project/types';

const TreeContext = React.createContext<TreeWithAccess | null>(null);

export function TreeProvider({ tree, children }: { tree: TreeWithAccess; children: React.ReactNode }) {
  return <TreeContext.Provider value={tree}>{children}</TreeContext.Provider>;
}

export function useTreeContext(): TreeWithAccess {
  const ctx = React.useContext(TreeContext);
  if (!ctx) throw new Error('useTreeContext must be used inside a tree page');
  return ctx;
}
