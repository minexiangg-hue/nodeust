import { localize, type Locale } from '@/lib/locale';
import type { Category, MatchReason } from '@/lib/community-model';

type Copy = [string, string, string];

const missingCopy: Record<string, Copy> = {
  from: [
    'Starting place or current hall',
    '出发地点或当前宿舍',
    '出發地點或目前宿舍',
  ],
  to: ['Destination or wanted hall', '目的地或目标宿舍', '目的地或目標宿舍'],
  from_conflict: [
    'Confirm the current hall',
    '确认当前宿舍，描述存在冲突',
    '確認目前宿舍，描述存在衝突',
  ],
  to_conflict: [
    'Confirm the wanted hall',
    '确认目标宿舍，描述存在冲突',
    '確認目標宿舍，描述存在衝突',
  ],
  term: ['Semester', '学期', '學期'],
  room: ['Current room type', '当前房型', '目前房型'],
  wantedRoom: ['Wanted room type', '目标房型', '目標房型'],
  eligibility: [
    'Housing eligibility requirements',
    '住宿资格要求',
    '住宿資格要求',
  ],
  currency: [
    'Currency of the price and budget',
    '价格与预算使用的货币',
    '價格與預算使用的貨幣',
  ],
  price: ['Price or budget', '价格或预算', '價格或預算'],
  price_ambiguous: ['Clarify the price', '明确价格', '釐清價格'],
  bundle_price: [
    'Price for the individual item',
    '单件物品的价格',
    '單件物品的價格',
  ],
  'price-basis': [
    'Whether the price is per item or a bundle',
    '价格按单件还是整套计算',
    '價格按單件還是整套計算',
  ],
  date: ['Actual date', '具体日期', '具體日期'],
  time: ['Time or available time window', '时间或可用时段', '時間或可用時段'],
  schedule: ['Clarify the date and time', '确认日期与时间', '確認日期與時間'],
  communication: ['Communication language', '交流语言', '交流語言'],
  topic: ['Study topic or chapter', '学习主题或章节', '學習主題或章節'],
  course: ['Course code or subject', '课程代码或科目', '課程代碼或科目'],
  place: ['Meeting or collection place', '见面或交收地点', '見面或交收地點'],
  seats: ['Available passenger seats', '可用乘客座位', '可用乘客座位'],
  party: ['Number of passengers', '同行人数', '同行人數'],
  capacity: ['Vehicle passenger capacity', '车辆可乘人数', '車輛可乘人數'],
  model: ['Exact item model', '具体型号', '具體型號'],
  condition: ['Item condition', '物品状况', '物品狀況'],
  quantity: ['Item quantity', '物品数量', '物品數量'],
  edition: ['Edition or version', '版本', '版本'],
  color: ['Colour', '颜色', '顏色'],
  book_identity: [
    'Book title, ISBN or edition',
    '书名、ISBN或版本',
    '書名、ISBN或版本',
  ],
  skill: [
    'Required experience or skill level',
    '经验或技能要求',
    '經驗或技能要求',
  ],
  'describe-request': [
    'What you offer or need, with specific details',
    '具体说明你能提供什么、需要什么',
    '具體說明你能提供甚麼、需要甚麼',
  ],
  inactive: [
    'Whether this request is still available',
    '需求是否仍然有效',
    '需求是否仍然有效',
  ],
};

export function matchMissingLabels(
  fields: string[],
  locale: Locale,
  kind?: Exclude<Category, 'all'>,
): string[] {
  return [
    ...new Set(
      fields.map((field) => {
        if (field === 'from' && kind === 'transport')
          return localize(locale, 'Departure place', '出发地点', '出發地點');
        if (field === 'to' && kind === 'transport')
          return localize(locale, 'Destination', '目的地', '目的地');
        return localize(
          locale,
          ...(missingCopy[field] ?? [
            'Clarify the request details',
            '进一步说明需求细节',
            '進一步說明需求細節',
          ]),
        );
      }),
    ),
  ];
}

export function matchReasonLabel(reason: MatchReason, locale: Locale): string {
  const labels: Record<string, Copy> = {
    'reverse-route': [
      'Your current and wanted halls complement each other.',
      '双方的当前宿舍与目标宿舍互补。',
      '雙方的目前宿舍與目標宿舍互補。',
    ],
    'term-year-unspecified': [
      'Both name the same semester; confirm its year in chat',
      '双方注明相同学期，具体年份请在沟通时确认',
      '雙方註明相同學期，具體年份請在溝通時確認',
    ],
    'housing-conditions': [
      'No conflict found in the housing conditions provided.',
      '已提供的住宿条件未发现冲突。',
      '已提供的住宿條件未發現衝突。',
    ],
    'supply-demand': [
      'One request offers the item the other is looking for.',
      '一方提供的物品正是另一方所需。',
      '一方提供的物品正是另一方所需。',
    ],
    'within-budget': [
      'The listed price is within the stated budget.',
      '标价在对方说明的预算内。',
      '標價在對方說明的預算內。',
    ],
    'time-compatible': [
      'The stated time windows are compatible.',
      '说明的时间安排相容。',
      '說明的時間安排相容。',
    ],
    'same-route': [
      'The travel direction agrees.',
      '出行方向一致。',
      '出行方向一致。',
    ],
    'compatible-transport': [
      'The ride or taxi-sharing roles fit.',
      '搭车或拼车需求互补。',
      '搭車或拼車需求互補。',
    ],
    'study-partners': [
      'Compatible study help or revision-partner requests.',
      '学习帮助或复习同伴需求相容。',
      '學習幫助或溫習同伴需求相容。',
    ],
    'activity-partners': [
      'You are both seeking company for the same activity.',
      '双方都在为同一活动寻找同伴。',
      '雙方都在為同一活動尋找同伴。',
    ],
  };
  return localize(
    locale,
    ...(labels[reason.code] ?? [
      'The published request details have points in common.',
      '已发布的需求有相容之处。',
      '已發佈的需求有相容之處。',
    ]),
  );
}
