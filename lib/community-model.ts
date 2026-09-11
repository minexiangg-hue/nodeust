import { ArrowLeftRight, Boxes, BookOpen, Bus, Sparkles } from 'lucide-react';
import { localize, type Locale } from '@/lib/locale';
import { campusLocations } from '@/lib/campus-locations';

export type Category =
  | 'all'
  | 'hall'
  | 'goods'
  | 'study'
  | 'transport'
  | 'other';
export type ActiveSection = 'explore' | 'matches' | 'chats' | 'saved' | 'posts';
export type Announcement = {
  id: string;
  title: string;
  body: string;
  kind: 'info' | 'maintenance' | 'upgrade';
  publishedAt: string | null;
  authorAlias: string;
};
export type RequestItem = {
  id: number | string;
  author: string;
  category: Exclude<Category, 'all'>;
  from: string;
  to: string;
  title: string;
  detail: string;
  age: string;
  replies: number;
  hall: string;
  locationId: string;
  demo?: boolean;
  mine?: boolean;
  persisted?: boolean;
};

export type Role = 'member' | 'moderator' | 'admin' | 'owner';

// The verified identity returned by GET /api/profile. Everything the old demo
// shell hard-coded (alias, avatar, role, real name/email) now comes from here.
export type ProfileMember = {
  id: string;
  anonymousAlias: string;
  nickname: string;
  fullName: string;
  email: string;
  affiliation: 'student' | 'staff' | 'faculty';
  role: Role;
  department: string | null;
  programme: string | null;
  yearOfStudy: string | null;
  contactMethod: string | null;
  contactValue: string | null;
  preferredLanguage: Locale;
  currentLocationId?: string | null;
};

export type ChatSession = {
  conversationId: string;
  peerAlias: string;
  postId: string | null;
  postTitle: string;
};

export type ConversationItem = {
  unreadCount: number;
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  postId: string | null;
  post: {
    id: string;
    title: string;
    category: Exclude<Category, 'all'>;
  } | null;
  peerId: string;
  peerAlias: string;
  lastMessage: {
    id: string;
    body: string;
    kind: string;
    createdAt: string;
    isMine: boolean;
  } | null;
};

export type WireMessage = {
  id: string;
  body: string;
  kind: 'message' | 'system' | 'contact_request' | 'contact_reveal';
  createdAt: string;
  alias: string;
  isMine: boolean;
};

export type FeedbackCategory = 'bug' | 'suggestion' | 'other';

export function feedbackCategoryLabel(
  category: FeedbackCategory,
  locale: Locale,
) {
  const labels: Record<FeedbackCategory, [string, string, string]> = {
    bug: ['Bug', '故障', '故障'],
    suggestion: ['Suggestion', '建议', '建議'],
    other: ['Other', '其他', '其他'],
  };
  const label = labels[category];
  return localize(locale, label[0], label[1], label[2]);
}

export function roleLabel(role: Role): string {
  return role === 'owner'
    ? 'Owner'
    : role === 'admin'
      ? 'Admin'
      : role === 'moderator'
        ? 'Moderator'
        : 'Member';
}

export function canModerateRole(role: Role): boolean {
  return role === 'owner' || role === 'admin' || role === 'moderator';
}

export function formatClock(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Coarse "2 h ago"-style label derived from the server createdAt on each poll.
export function formatAge(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr`;
  return `${Math.floor(hours / 24)} d`;
}

export function contactLine(
  method: string | null,
  value: string | null,
): string {
  return [method, value].filter(Boolean).join(' · ') || '';
}

export type PostPayload = {
  id: string;
  category: string;
  title: string;
  body: string;
  locationId: string | null;
  currentHall: string | null;
  targetHall: string | null;
  replyCount: number;
  createdAt: string;
  anonymousAlias: string;
  isMine: boolean;
};

// The feed is server-authoritative: demo placeholders are gone and everything
// rendered comes from GET /api/posts (or a freshly published post).
export function mapPost(payload: PostPayload): RequestItem {
  return {
    id: payload.id,
    author: payload.anonymousAlias,
    category:
      payload.category === 'service'
        ? 'other'
        : (payload.category as Exclude<Category, 'all'>),
    from: payload.currentHall ?? '',
    to: payload.targetHall ?? '',
    title: payload.title,
    detail: payload.body,
    age: formatAge(payload.createdAt),
    replies: payload.replyCount,
    hall: (payload.currentHall ?? '').replace('Hall ', ''),
    locationId:
      payload.locationId ||
      campusLocations.find(
        (location) => location.shortLabel === payload.currentHall,
      )?.id ||
      'academic-building',
    mine: payload.isMine,
    persisted: true,
  };
}

export const copy = {
  'zh-CN': {
    explore: '探索广场',
    matches: '我的匹配',
    chats: '匿名私聊',
    saved: '已收藏',
    moderation: '管理中心',
    search: '搜索地点、物品或需求…',
    post: '发布需求',
    plaza: '校园需求地图',
    list: '列表',
    live: '实时需求',
    online: '位用户在线',
    filters: '筛选',
    all: '全部',
    hall: '宿舍',
    goods: '物品交换',
    study: '学习互助',
    transport: '交通',
    other: '其他',
    ug: '本科宿舍',
    pg: '研究生宿舍',
    detail: '需求详情',
    chat: '匿名沟通',
    report: '举报',
    profile: '你的身份已验证',
    hidden: '真实资料默认隐藏',
    demo: '本地演示模式',
    notice: '仅用于寻找匹配对象，换宿须通过 SHRLO 官方流程。',
  },
  'zh-HK': {
    explore: '探索廣場',
    matches: '我的配對',
    chats: '匿名私聊',
    saved: '已收藏',
    moderation: '管理中心',
    search: '搜尋地點、物品或需求…',
    post: '發佈需求',
    plaza: '校園需求地圖',
    list: '列表',
    live: '即時需求',
    online: '位用戶在線',
    filters: '篩選',
    all: '全部',
    hall: '宿舍',
    goods: '物品交換',
    study: '學習互助',
    transport: '交通',
    other: '其他',
    ug: '本科宿舍',
    pg: '研究生宿舍',
    detail: '需求詳情',
    chat: '匿名溝通',
    report: '舉報',
    profile: '你的身份已驗證',
    hidden: '真實資料預設隱藏',
    demo: '本地演示模式',
    notice: '僅用於尋找配對對象，換宿須通過 SHRLO 官方流程。',
  },
  en: {
    explore: 'Explore plaza',
    matches: 'My matches',
    chats: 'Anonymous chat',
    saved: 'Saved',
    moderation: 'Moderation',
    search: 'Search places, items or requests…',
    post: 'Post a request',
    plaza: 'Campus request map',
    list: 'List',
    live: 'Live requests',
    online: 'people online',
    filters: 'Filters',
    all: 'All',
    hall: 'Housing',
    goods: 'Exchange',
    study: 'Study help',
    transport: 'Transport',
    other: 'Other',
    ug: 'UG halls',
    pg: 'PG halls',
    detail: 'Request details',
    chat: 'Chat anonymously',
    report: 'Report',
    profile: 'Identity verified',
    hidden: 'Personal details stay hidden',
    demo: 'Local demo mode',
    notice:
      'Find a match here; complete every hall swap through the official SHRLO process.',
  },
};

export const categoryMeta = {
  hall: { icon: ArrowLeftRight, color: '#ff7a59' },
  goods: { icon: Boxes, color: '#ffd166' },
  study: { icon: BookOpen, color: '#63e6be' },
  transport: { icon: Bus, color: '#b5a0ff' },
  other: { icon: Sparkles, color: '#66b3ff' },
};

export const localeLabels: Record<Locale, string> = {
  'zh-CN': '简',
  'zh-HK': '繁',
  en: 'EN',
};
