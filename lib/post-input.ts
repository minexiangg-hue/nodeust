import { campusLocationIds } from '@/lib/campus-locations';
import { validatePublicContent } from '@/lib/content-policy';

export function parsePostInput(input: Record<string, unknown>) {
  const category = input.category;
  if (
    category !== 'hall' &&
    category !== 'goods' &&
    category !== 'study' &&
    category !== 'transport' &&
    category !== 'other'
  )
    throw new Error('INVALID_POST:无效的需求类型。');
  const locationId =
    typeof input.locationId === 'string' ? input.locationId : '';
  if (!campusLocationIds.has(locationId))
    throw new Error('INVALID_POST:请选择一个有效的校园地点。');
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  const error = validatePublicContent(title, body);
  if (error) throw new Error(`INVALID_POST:${error}`);
  const hall = (value: unknown) =>
    typeof value === 'string' ? value.trim() : '';
  const currentHall = hall(input.currentHall);
  const targetHall = hall(input.targetHall);
  if (currentHall.length > 80 || targetHall.length > 80)
    throw new Error('INVALID_POST:宿舍名称不能超过 80 字。');
  if (category === 'hall' && (!currentHall || !targetHall))
    throw new Error('INVALID_POST:换宿需求必须填写当前及目标宿舍。');
  return {
    category,
    title,
    body,
    locationId,
    currentHall: category === 'hall' ? currentHall : null,
    targetHall: category === 'hall' ? targetHall : null,
  } as const;
}
