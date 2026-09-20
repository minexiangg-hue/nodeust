import type { ParsedPost } from './types.ts';

/** Author-edit guidance; advisory omissions must not become pairwise hard constraints. */
export function ownPostGuidance(own: ParsedPost[]) {
  return own.flatMap(row => {
    const missing = [...new Set(row.intents.length
      ? row.intents.flatMap(intent => [
          ...intent.missing,
          ...(intent.kind === 'goods' && intent.price !== undefined && intent.price > 0 && !intent.currency
            ? ['currency'] : []),
        ])
      : row.warnings)];
    return missing.length ? [{ id: row.post.id, title: row.post.title, missing }] : [];
  });
}
