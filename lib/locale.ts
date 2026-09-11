export type Locale = 'en' | 'zh-CN' | 'zh-HK';

export function localize(
  locale: Locale,
  en: string,
  zhCn: string,
  zhHk: string,
) {
  return locale === 'en' ? en : locale === 'zh-HK' ? zhHk : zhCn;
}

export const categoryLabels = {
  all: ['All requests', '全部需求', '全部需求'],
  hall: ['Housing', '宿舍', '宿舍'],
  goods: ['Exchange', '物品交换', '物品交換'],
  study: ['Study help', '学习互助', '學習互助'],
  transport: ['Transport', '交通', '交通'],
  other: ['Other', '其他', '其他'],
} as const;

export function categoryLabel(
  category: keyof typeof categoryLabels,
  locale: Locale,
) {
  const label = categoryLabels[category];
  return localize(locale, label[0], label[1], label[2]);
}

export function recordStatusLabel(status: string, locale: Locale) {
  const labels: Record<string, [string, string, string]> = {
    active: ['Active', '展示中', '展示中'],
    closed: ['Closed', '已关闭', '已關閉'],
    matched: ['Matched', '已匹配', '已配對'],
    removed: ['Removed', '已删除或被移除', '已刪除或被移除'],
    open: ['Open', '待处理', '待處理'],
    resolved: ['Resolved', '已处理', '已處理'],
    dismissed: ['Dismissed', '已忽略', '已忽略'],
    published: ['Published', '已发布', '已發佈'],
    archived: ['Archived', '已归档', '已歸檔'],
    draft: ['Draft', '草稿', '草稿'],
  };
  const text = labels[status];
  return text ? localize(locale, ...text) : status;
}

export function reportReasonLabel(reason: string, locale: Locale) {
  const labels: Record<string, [string, string, string]> = {
    illegal: ['Illegal activity', '违法或违规信息', '違法或違規信息'],
    hall_trade: ['Hall-place trading', '宿位交易', '宿位交易'],
    fraud: ['Fraud / impersonation', '诈骗与冒充', '詐騙與冒充'],
    harassment: ['Harassment', '骚扰与威胁', '騷擾與威脅'],
    hate: ['Hate / discrimination', '仇恨与歧视', '仇恨與歧視'],
    sexual: ['Sexual content', '色情与性交易', '色情與性交易'],
    privacy: ['Privacy violation', '隐私泄露', '私隱洩漏'],
    spam: ['Spam / promotion', '垃圾信息与推广', '垃圾信息與推廣'],
    other: ['Other', '其他', '其他'],
  };
  return localize(locale, ...(labels[reason] ?? labels.other));
}
