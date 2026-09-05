export const forbiddenContent = [
  {
    code: 'illegal',
    label: '违法或违规信息',
    labelEn: 'Illegal or prohibited activity',
    description: '违法交易、违禁品、协助作弊、规避学校规定或其他违法违规内容。',
    descriptionEn:
      'Illegal trading, prohibited goods, academic cheating, evasion of university rules or other unlawful content.',
  },
  {
    code: 'hall_trade',
    label: '宿位交易',
    labelEn: 'Hall-place trading',
    description:
      '出售、出租、加价或以利益交换 hall place，以及未经 SHRLO 批准的私下换房。',
    descriptionEn:
      'Selling, renting or trading a hall place for a benefit, or arranging a private room change without SHRLO approval.',
  },
  {
    code: 'fraud',
    label: '诈骗与冒充',
    labelEn: 'Fraud and impersonation',
    description: '虚假需求、钓鱼链接、索取密码或验证码、冒充他人或机构。',
    descriptionEn:
      'False requests, phishing links, requests for passwords or verification codes, and impersonation.',
  },
  {
    code: 'harassment',
    label: '骚扰与威胁',
    labelEn: 'Harassment and threats',
    description: '跟踪、威胁、人身攻击、重复骚扰或未经同意的性暗示。',
    descriptionEn:
      'Stalking, threats, personal attacks, repeated harassment or unwanted sexual remarks.',
  },
  {
    code: 'hate',
    label: '仇恨与歧视',
    labelEn: 'Hate and discrimination',
    description: '基于种族、国籍、性别、宗教、残障等身份特征的贬损或排斥。',
    descriptionEn:
      'Abuse or exclusion based on race, nationality, gender, religion, disability or another protected identity.',
  },
  {
    code: 'sexual',
    label: '色情与性交易',
    labelEn: 'Sexual content and services',
    description: '露骨色情内容、性服务交易、涉及未成年人的不当内容。',
    descriptionEn:
      'Explicit sexual content, sexual services or any inappropriate content involving minors.',
  },
  {
    code: 'privacy',
    label: '隐私泄露',
    labelEn: 'Privacy violations',
    description:
      '公开本人或他人的学号、房号、电话、真实姓名、课程表或可定位信息。',
    descriptionEn:
      'Publishing student IDs, room numbers, phone numbers, real names, timetables or precise identifying information.',
  },
  {
    code: 'spam',
    label: '垃圾信息与推广',
    labelEn: 'Spam and promotion',
    description: '刷屏、重复发布、引流、未经许可的商业广告或传销。',
    descriptionEn:
      'Flooding, duplicate posts, traffic diversion, unauthorised advertising or pyramid schemes.',
  },
] as const;

const blockedPatterns = [
  /(?:出售|售卖|出租|加价|bid|sell|rent).{0,10}(?:宿位|床位|hall\s*place)/i,
  /(?:password|密码|verification\s*code|验证码)/i,
  /(?:\+?852[-\s]?)?[456789]\d{3}[-\s]?\d{4}/,
  /\b\d{8}\b/,
  /(?:room|房间?|房号)\s*[A-Z]?\d{3,5}/i,
];

export function validatePublicContent(
  title: string,
  body: string,
): string | null {
  const value = `${title}\n${body}`.trim();
  if (!title.trim() || !body.trim()) return 'Title and details are required.';
  if (title.length > 100 || body.length > 2000)
    return 'The content is too long. Please shorten it before publishing.';
  if (blockedPatterns.some((pattern) => pattern.test(value))) {
    return 'The content may include hall-place trading, account credentials or personal contact details. Remove them before publishing.';
  }
  return null;
}
