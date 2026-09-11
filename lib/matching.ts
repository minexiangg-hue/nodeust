/** The existing housing-only rule, shared with the reproducible evaluation.
 * Callers supply the active feed; this deliberately does not expand its window. */
export function findReciprocalHousingMatches<
  T extends { category: string; mine?: boolean; from: string; to: string },
>(items: readonly T[]): T[] {
  const mine = items.filter((item) => item.mine && item.category === 'hall');
  return items.filter(
    (item) =>
      !item.mine &&
      item.category === 'hall' &&
      mine.some((own) => own.from === item.to && own.to === item.from),
  );
}
