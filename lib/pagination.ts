export const PAGE_SIZE = 25;

export function pageOffset(params: URLSearchParams) {
  const page = Number(params.get('page') ?? 0);
  return (
    (Number.isSafeInteger(page) && page >= 0 ? Math.min(page, 100_000) : 0) *
    PAGE_SIZE
  );
}

export function pagedItems<T>(rows: T[]) {
  return { items: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}
