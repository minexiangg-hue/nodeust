import type { MatchIndex } from './engine.ts';

// Shared across Next route bundles in the single server process. Disposable on restart.
type IndexState = {
  snapshot?: { index: MatchIndex; expires: number };
  pending?: Promise<{ index: MatchIndex; generation: number }>;
  generation: number;
};
const globalState = globalThis as typeof globalThis & {
  nodeMatchingIndexState?: IndexState;
};
export const matchIndexState = (globalState.nodeMatchingIndexState ??= {
  generation: 0,
});
export function invalidateMatchIndex(): void {
  matchIndexState.generation++;
  matchIndexState.snapshot = undefined;
}
