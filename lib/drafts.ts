export type PostDraft = {
  id: string;
  updatedAt: string;
  category: 'hall' | 'goods' | 'study' | 'other';
  title: string;
  detail: string;
  from: string;
  to: string;
  locationId: string;
};

export function parseDrafts(raw: string | null): PostDraft[] {
  const value: unknown = JSON.parse(raw || '[]');
  if (!Array.isArray(value)) throw new Error('Invalid draft storage');
  return value.filter(
    (item): item is PostDraft =>
      item &&
      ['hall', 'goods', 'study', 'other'].includes(item.category) &&
      ['id', 'updatedAt', 'title', 'detail', 'from', 'to', 'locationId'].every(
        (key) => typeof item[key] === 'string',
      ),
  );
}
