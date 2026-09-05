export const forbiddenContent = [
  {
    code: 'illegal',
    label: '违法或违规信息',
    description: '违法交易、违禁品、协助作弊、规避学校规定或其他违法违规内容。',
  },
  {
    code: 'hall_trade',
    label: '宿位交易',
    description:
      '出售、出租、加价或以利益交换 hall place，以及未经 SHRLO 批准的私下换房。',
  },
  {
    code: 'fraud',
    label: '诈骗与冒充',
    description: '虚假需求、钓鱼链接、索取密码或验证码、冒充他人或机构。',
  },
  {
    code: 'harassment',
    label: '骚扰与威胁',
    description: '跟踪、威胁、人身攻击、重复骚扰或未经同意的性暗示。',
  },
  {
    code: 'hate',
    label: '仇恨与歧视',
    description: '基于种族、国籍、性别、宗教、残障等身份特征的贬损或排斥。',
  },
  {
    code: 'sexual',
    label: '色情与性交易',
    description: '露骨色情内容、性服务交易、涉及未成年人的不当内容。',
  },
  {
    code: 'privacy',
    label: '隐私泄露',
    description:
      '公开本人或他人的学号、房号、电话、真实姓名、课程表或可定位信息。',
  },
  {
    code: 'spam',
    label: '垃圾信息与推广',
    description: '刷屏、重复发布、引流、未经许可的商业广告或传销。',
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
  if (!title.trim() || !body.trim()) return '标题和补充说明不能为空。';
  if (title.length > 100 || body.length > 2000)
    return '内容过长，请精简后再发布。';
  if (blockedPatterns.some((pattern) => pattern.test(value))) {
    return '内容可能包含宿位交易、账号凭据或个人联系方式，请删除后再发布。';
  }
  return null;
}
