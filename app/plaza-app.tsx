'use client';
/* oxlint-disable next/no-html-link-for-pages */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Ban,
  Bell,
  BookOpen,
  Bookmark,
  Boxes,
  ChevronDown,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Flag,
  Gavel,
  List,
  LogOut,
  Map,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquarePlus,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  UserPlus,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  campusLocations,
  getCampusLocation,
  getCampusLocationLabel,
  getLocationGroupDescription,
  getLocationGroupLabel,
  locationGroups,
  type LocationGroupId,
} from '@/lib/campus-locations';

type Locale = 'zh-CN' | 'zh-HK' | 'en';
type Category = 'all' | 'hall' | 'goods' | 'study' | 'other';
type ActiveSection = 'explore' | 'matches' | 'chats' | 'saved';
type Announcement = {
  id: string;
  title: string;
  body: string;
  kind: 'info' | 'maintenance' | 'upgrade';
  publishedAt: string | null;
  authorAlias: string;
};
type RequestItem = {
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

type Role = 'member' | 'moderator' | 'admin' | 'owner';

// The verified identity returned by GET /api/profile. Everything the old demo
// shell hard-coded (alias, avatar, role, real name/email) now comes from here.
type ProfileMember = {
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

type ChatSession = {
  conversationId: string;
  peerAlias: string;
  postId: string | null;
  postTitle: string;
};

type ConversationItem = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  postId: string | null;
  post: { id: string; title: string; category: Exclude<Category, 'all'> } | null;
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

type WireMessage = {
  id: string;
  body: string;
  kind: 'message' | 'system' | 'contact_request' | 'contact_reveal';
  createdAt: string;
  alias: string;
  isMine: boolean;
};

// An open report from the moderation queue (GET /api/admin/reports), enriched
// server-side with the human-readable target and the reporter's alias.
type AdminReport = {
  id: string;
  targetType: 'post' | 'message' | 'user';
  targetId: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  targetLabel: string;
  targetAlias: string;
  reporterAlias: string;
};

type FeedbackCategory = 'bug' | 'suggestion' | 'other';
type FeedbackStatus = 'open' | 'resolved';

// A member-submitted feedback row (GET /api/feedback, Owner only), enriched
// server-side with the submitter's username (users.identity_id) + anonymous alias.
type AdminFeedback = {
  id: string;
  category: FeedbackCategory;
  body: string;
  status: FeedbackStatus;
  createdAt: string;
  resolvedAt: string | null;
  username: string;
  alias: string;
};

function feedbackCategoryLabel(category: FeedbackCategory, locale: Locale) {
  const labels: Record<FeedbackCategory, [string, string, string]> = {
    bug: ['Bug', '故障', '故障'],
    suggestion: ['Suggestion', '建议', '建議'],
    other: ['Other', '其他', '其他'],
  };
  const label = labels[category];
  return localize(locale, label[0], label[1], label[2]);
}

function feedbackStatusLabel(status: FeedbackStatus, locale: Locale) {
  return status === 'open'
    ? localize(locale, 'Open', '待处理', '待處理')
    : localize(locale, 'Resolved', '已处理', '已處理');
}

// Bilingual labels for the report `reason` enum (mirrors lib/content-policy.ts).
function reportReasonLabel(reason: string, locale: Locale): string {
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
  const label = labels[reason] ?? labels.other;
  return localize(locale, label[0], label[1], label[2]);
}

function targetTypeLabel(targetType: AdminReport['targetType'], locale: Locale): string {
  return targetType === 'post'
    ? localize(locale, 'Post', '帖子', '帖子')
    : targetType === 'user'
      ? localize(locale, 'User', '用户', '用戶')
      : localize(locale, 'Message', '消息', '消息');
}

function roleLabel(role: Role): string {
  return role === 'owner'
    ? 'Owner'
    : role === 'admin'
      ? 'Admin'
      : role === 'moderator'
        ? 'Moderator'
        : 'Member';
}

function canModerateRole(role: Role): boolean {
  return role === 'owner' || role === 'admin' || role === 'moderator';
}

function formatClock(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Coarse "2 h ago"-style label derived from the server createdAt on each poll.
function formatAge(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr`;
  return `${Math.floor(hours / 24)} d`;
}

function contactLine(method: string | null, value: string | null): string {
  return [method, value].filter(Boolean).join(' · ') || '';
}

type PostPayload = {
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
function mapPost(payload: PostPayload): RequestItem {
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

const copy = {
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

const categoryMeta = {
  hall: { icon: ArrowLeftRight, color: '#ff7a59' },
  goods: { icon: Boxes, color: '#ffd166' },
  study: { icon: BookOpen, color: '#63e6be' },
  other: { icon: Sparkles, color: '#66b3ff' },
};

/* Replaced by the shared campus location registry in lib/campus-locations.ts.
const halls = [
  { id: 'I', label: 'Hall I', count: 12, x: 10, y: 16, size: 122, group: 'ug' },
  { id: 'II', label: 'Hall II', count: 8, x: 32, y: 8, size: 98, group: 'ug' },
  {
    id: 'III',
    label: 'Hall III',
    count: 15,
    x: 54,
    y: 18,
    size: 132,
    group: 'ug',
  },
  { id: 'IV', label: 'Hall IV', count: 6, x: 78, y: 8, size: 88, group: 'ug' },
  { id: 'V', label: 'Hall V', count: 11, x: 19, y: 47, size: 112, group: 'ug' },
  { id: 'VI', label: 'Hall VI', count: 7, x: 43, y: 49, size: 92, group: 'ug' },
  {
    id: 'VII',
    label: 'Hall VII',
    count: 18,
    x: 70,
    y: 40,
    size: 142,
    group: 'ug',
  },
  {
    id: 'VIII',
    label: 'Hall VIII',
    count: 5,
    x: 5,
    y: 76,
    size: 84,
    group: 'ug',
  },
  {
    id: 'IX',
    label: 'Hall IX',
    count: 9,
    x: 31,
    y: 78,
    size: 102,
    group: 'ug',
  },
  { id: 'X', label: 'Hall X', count: 4, x: 56, y: 76, size: 80, group: 'ug' },
  { id: 'XI', label: 'Hall XI', count: 7, x: 81, y: 70, size: 96, group: 'ug' },
  {
    id: 'XII',
    label: 'Hall XII',
    count: 3,
    x: 91,
    y: 36,
    size: 76,
    group: 'ug',
  },
  {
    id: 'XIII',
    label: 'Hall XIII',
    count: 6,
    x: 94,
    y: 88,
    size: 90,
    group: 'ug',
  },
  {
    id: 'JCH',
    label: 'Jockey Club Hall',
    count: 10,
    x: 43,
    y: 94,
    size: 114,
    group: 'ug',
  },
  {
    id: 'UAA',
    label: 'UA Tower A',
    count: 8,
    x: 14,
    y: 26,
    size: 120,
    group: 'pg',
  },
  {
    id: 'UAB',
    label: 'UA Tower B',
    count: 6,
    x: 43,
    y: 16,
    size: 104,
    group: 'pg',
  },
  {
    id: 'SKCC',
    label: 'SKCC Hall',
    count: 5,
    x: 71,
    y: 31,
    size: 92,
    group: 'pg',
  },
  { id: 'GGT', label: 'GGT', count: 13, x: 43, y: 67, size: 138, group: 'pg' },
] as const;
*/


const localeLabels: Record<Locale, string> = {
  'zh-CN': '简',
  'zh-HK': '繁',
  en: 'EN',
};

function localize(locale: Locale, en: string, zhCn: string, zhHk: string) {
  return locale === 'en' ? en : locale === 'zh-HK' ? zhHk : zhCn;
}

export function PlazaApp() {
  const [locale, setLocale] = useState<Locale>('en');
  const [category, setCategory] = useState<Category>('all');
  const [group, setGroup] = useState<LocationGroupId>('ug-housing');
  const [activeSection, setActiveSection] = useState<ActiveSection>('explore');
  const [view, setView] = useState<'plaza' | 'list'>('plaza');
  const [query, setQuery] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  );
  const [currentLocationId, setCurrentLocationId] =
    useState('academic-building');
  const [items, setItems] = useState<RequestItem[]>([]);
  const [selected, setSelected] = useState<RequestItem | null>(null);
  const [profile, setProfile] = useState<ProfileMember | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [showBubbles, setShowBubbles] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [adminOpen, setAdminOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [zoom, setZoom] = useState(1);
  const t = copy[locale];

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const matchesCategory =
          category === 'all' || item.category === category;
        const location = getCampusLocation(item.locationId);
        const matchesQuery =
          !query ||
          `${item.title} ${item.detail} ${item.from} ${item.to} ${location?.label ?? ''} ${location?.shortLabel ?? ''}`
            .toLowerCase()
            .includes(query.toLowerCase());
        return matchesCategory && matchesQuery;
      }),
    [category, items, query],
  );

  const visibleLocations = campusLocations.filter(
    (location) => location.group === group,
  );
  const currentLocation = getCampusLocation(currentLocationId);
  const selectedLocation = getCampusLocation(selectedLocationId);
  const selectedLocationItems = selectedLocationId
    ? items.filter((item) => item.locationId === selectedLocationId)
    : [];
  const myHallRequests = items.filter(
    (item) => item.mine && item.category === 'hall',
  );
  const matchItems = items.filter(
    (item) =>
      !item.mine &&
      item.category === 'hall' &&
      myHallRequests.some(
        (mine) => mine.from === item.to && mine.to === item.from,
      ),
  );
  const savedItems = items.filter((item) => savedIds.has(String(item.id)));
  const sectionItems =
    activeSection === 'matches'
      ? matchItems
      : activeSection === 'saved'
        ? savedItems
        : filtered;

  const loadPosts = async () => {
    try {
      const response = await fetch('/api/posts');
      if (!response.ok) return;
      const result = (await response.json()) as { items?: PostPayload[] };
      setItems((result.items ?? []).map((payload) => mapPost(payload)));
    } catch {
      /* Keep the current feed on transient errors. */
    }
  };

  const loadConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      if (!response.ok) return;
      const result = (await response.json()) as { items?: ConversationItem[] };
      setConversations(result.items ?? []);
    } catch {
      /* Ignore transient failures; the next poll retries. */
    }
  };

  const openSession = (session: ChatSession) => {
    setChatSession(session);
    void loadConversations();
  };

  // From a post detail: open a thread with its author (creating or reusing the
  // conversation). For the poster's own request, jump to their inbox instead.
  const ensureThread = async (item: RequestItem) => {
    if (item.mine) {
      setSelected(null);
      setActiveSection('chats');
      setView('list');
      void loadConversations();
      return;
    }
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ postId: String(item.id) }),
      });
      const result = (await response.json()) as {
        id?: string;
        error?: string;
      };
      if (!response.ok || !result.id)
        throw new Error(result.error || 'unavailable');
      setSelected(null);
      openSession({
        conversationId: result.id,
        peerAlias: item.author,
        postId: String(item.id),
        postTitle: item.title,
      });
    } catch {
      setNotice(
        localize(
          locale,
          'Could not start the conversation. Please try again.',
          '暂时无法发起会话，请稍后再试。',
          '暫時無法發起會話，請稍後再試。',
        ),
      );
    }
  };

  const reloadProfile = async () => {
    try {
      const response = await fetch('/api/profile');
      if (!response.ok) return;
      const result = (await response.json()) as { profile?: ProfileMember };
      if (!result.profile) return;
      setProfile(result.profile);
      if (
        result.profile.currentLocationId &&
        getCampusLocation(result.profile.currentLocationId)
      )
        setCurrentLocationId(result.profile.currentLocationId);
      if (['en', 'zh-CN', 'zh-HK'].includes(result.profile.preferredLanguage))
        setLocale(result.profile.preferredLanguage);
    } catch {
      /* Profile is non-critical on first paint. */
    }
  };

  const toggleSaved = (item: RequestItem) => {
    setSavedIds((current) => {
      const next = new Set(current);
      const key = String(item.id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const updateLocation = async (locationId: string) => {
    setCurrentLocationId(locationId);
    try {
      const response = await fetch('/api/location', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ locationId }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error);
      setNotice(
        localize(
          locale,
          `Location updated to ${getCampusLocationLabel(getCampusLocation(locationId), locale)}.`,
          `地点标签已更新为 ${getCampusLocationLabel(getCampusLocation(locationId), locale)}。`,
          `地點標籤已更新為 ${getCampusLocationLabel(getCampusLocation(locationId), locale)}。`,
        ),
      );
    } catch {
      setNotice(
        localize(
          locale,
          'The tag changed on this page, but could not sync to the database.',
          '地点已在本页更新，但暂时无法同步到本地数据库。',
          '地點已在本頁更新，但暫時無法同步到本地資料庫。',
        ),
      );
    }
  };

  const publishPost = async (item: RequestItem) => {
    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          category: item.category,
          title: item.title,
          body: item.detail,
          locationId: item.locationId,
          currentHall: item.from || null,
          targetHall: item.to || null,
        }),
      });
      const result = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !result.id) {
        setNotice(
          result.error ??
            localize(
              locale,
              'Could not publish. Please try again.',
              '发布失败，请稍后再试。',
              '發佈失敗，請稍後再試。',
            ),
        );
        return;
      }
      await loadPosts();
      setCreateOpen(false);
      setNotice(
        localize(
          locale,
          'Your request is now live.',
          '需求已发布到广场。',
          '需求已發佈到廣場。',
        ),
      );
    } catch {
      setNotice(
        localize(
          locale,
          'Could not publish. Check the local service and try again.',
          '发布失败，请检查本地服务后重试。',
          '發佈失敗，請檢查本地服務後重試。',
        ),
      );
    }
  };

  useEffect(() => {
    void loadPosts();
  }, []);

  useEffect(() => {
    void loadConversations();
  }, []);

  useEffect(() => {
    void reloadProfile();
  }, []);

  // Lightweight polling so a second browser sees new posts / inbound chats
  // without a manual refresh.
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === 'hidden') return;
      void loadPosts();
      void loadConversations();
    };
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    void fetch('/api/announcements')
      .then(async (response) => {
        if (!response.ok) return [];
        const result = (await response.json()) as {
          items?: Announcement[];
        };
        return result.items ?? [];
      })
      .then(setAnnouncements)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    try {
      const storedSaved = JSON.parse(
        localStorage.getItem('node:saved') || '[]',
      ) as string[];
      const storedLocale = localStorage.getItem('node:locale') as Locale | null;
      const storedBubbleSetting = localStorage.getItem('node:show-bubbles');
      queueMicrotask(() => {
        setSavedIds(new Set(storedSaved));
        if (storedLocale && ['en', 'zh-CN', 'zh-HK'].includes(storedLocale))
          setLocale(storedLocale);
        if (storedBubbleSetting === 'false') setShowBubbles(false);
      });
    } catch {
      localStorage.removeItem('node:saved');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('node:saved', JSON.stringify([...savedIds]));
  }, [savedIds]);

  useEffect(() => {
    localStorage.setItem('node:locale', locale);
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    localStorage.setItem('node:show-bubbles', String(showBubbles));
  }, [showBubbles]);

  useEffect(() => {
    const modelContext = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: Record<string, unknown>,
            options?: { signal?: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Record<string, unknown>) => {
      try {
        void Promise.resolve(
          modelContext.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => undefined);
      } catch {
        /* Unsupported preview host. */
      }
    };
    register({
      name: 'search_requests',
      title: 'Search NODE requests',
      description:
        'Filter the visible NODE campus map by keyword, category, or campus location without creating or changing any post.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          category: {
            type: 'string',
            enum: ['all', 'hall', 'goods', 'study', 'other'],
          },
          location: { type: 'string' },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input: unknown) {
        const value =
          input && typeof input === 'object'
            ? (input as {
                query?: unknown;
                category?: unknown;
                location?: unknown;
              })
            : {};
        if (value.query !== undefined && typeof value.query !== 'string')
          throw new Error('query must be a string');
        if (
          value.category !== undefined &&
          (typeof value.category !== 'string' ||
            !['all', 'hall', 'goods', 'study', 'other'].includes(
              value.category,
            ))
        )
          throw new Error('invalid category');
        setQuery(typeof value.query === 'string' ? value.query : '');
        setCategory((value.category as Category) || 'all');
        if (
          typeof value.location === 'string' &&
          getCampusLocation(value.location)
        ) {
          const location = getCampusLocation(value.location)!;
          setGroup(location.group);
          setSelectedLocationId(location.id);
        }
        setActiveSection('explore');
        return { status: 'filtered', visibleSurface: 'campus_request_map' };
      },
    });
    register({
      name: 'start_request_creation',
      title: 'Start a NODE request',
      description:
        'Open the visible request form for the verified user. This does not publish anything.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute() {
        setCreateOpen(true);
        return { status: 'form_opened' };
      },
    });
    return () => lifecycle.abort();
  }, []);

  const aliasInitial =
    profile?.anonymousAlias?.trim().charAt(0).toUpperCase() ?? '?';
  const canModerate = profile ? canModerateRole(profile.role) : false;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="app-header">
        <div className="brand" aria-label="NODE home">
          <span className="brand-mark">
            <span />
          </span>
          <span>NODE</span>
          <Badge className="beta-badge">HKUST · BETA</Badge>
        </div>
        <label className="search-box">
          <Search aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.search}
            aria-label={t.search}
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search">
              <X />
            </button>
          )}
        </label>
        <div className="header-actions">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            className="header-icon"
          >
            <Bell />
          </Button>
          <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
            <DialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={localize(
                    locale,
                    'Send feedback',
                    '发送反馈',
                    '發送反饋',
                  )}
                  className="header-icon"
                />
              }
            >
              <MessageSquarePlus />
            </DialogTrigger>
            <FeedbackDialog
              locale={locale}
              onClose={() => setFeedbackOpen(false)}
              onSent={(message) => {
                setFeedbackOpen(false);
                setNotice(message);
              }}
            />
          </Dialog>
          <button
            className="language-switch"
            onClick={() =>
              setLocale(
                locale === 'zh-CN'
                  ? 'zh-HK'
                  : locale === 'zh-HK'
                    ? 'en'
                    : 'zh-CN',
              )
            }
          >
            {localeLabels[locale]} <ChevronDown />
          </button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger
              render={<Button className="post-button" size="lg" />}
            >
              <Plus /> {t.post}
            </DialogTrigger>
            <CreatePostDialog
              t={t}
              locale={locale}
              onCreated={publishPost}
              currentLocationId={currentLocationId}
              authorAlias={profile?.anonymousAlias ?? ''}
            />
          </Dialog>
          <button
            className="avatar-button"
            aria-label="Account"
            onClick={() => setProfileOpen(true)}
          >
            <span>{aliasInitial}</span>
            <i />
          </button>
        </div>
      </header>

      <div className="app-shell">
        <aside className="left-rail">
          <nav aria-label="Primary">
            <RailLink
              icon={Map}
              label={t.explore}
              active={activeSection === 'explore'}
              onClick={() => setActiveSection('explore')}
            />
            <RailLink
              icon={Sparkles}
              label={t.matches}
              count={matchItems.length || undefined}
              active={activeSection === 'matches'}
              onClick={() => setActiveSection('matches')}
            />
            <RailLink
              icon={MessageCircle}
              label={t.chats}
              count={conversations.length || undefined}
              active={activeSection === 'chats'}
              onClick={() => setActiveSection('chats')}
            />
            <RailLink
              icon={Bookmark}
              label={t.saved}
              count={savedItems.length || undefined}
              active={activeSection === 'saved'}
              onClick={() => setActiveSection('saved')}
            />
          </nav>
          <section className="filter-section">
            <p>{t.filters}</p>
            <FilterButton
              label={t.all}
              icon={SlidersHorizontal}
              active={category === 'all'}
              onClick={() => {
                setCategory('all');
                setActiveSection('explore');
              }}
            />
            {(Object.keys(categoryMeta) as Exclude<Category, 'all'>[]).map(
              (key) => {
                const meta = categoryMeta[key];
                return (
                  <FilterButton
                    key={key}
                    label={t[key]}
                    icon={meta.icon}
                    color={meta.color}
                    active={category === key}
                    onClick={() => {
                      setCategory(key);
                      setActiveSection('explore');
                    }}
                  />
                );
              },
            )}
          </section>
          {canModerate && (
            <button className="admin-link" onClick={() => setAdminOpen(true)}>
              <ShieldCheck /> {t.moderation}
              <Badge>{roleLabel(profile!.role)}</Badge>
            </button>
          )}
          <div className="identity-card">
            <div className="mini-avatar">{aliasInitial}</div>
            <div>
              <strong>{profile?.anonymousAlias ?? '…'}</strong>
              <span>
                <ShieldCheck />{' '}
                {profile
                  ? `${roleLabel(profile.role)} · ${t.profile}`
                  : t.profile}
              </span>
            </div>
            <MoreHorizontal />
            <p>{t.hidden}</p>
            <p className="identity-location">
              <MapPin /> {getCampusLocationLabel(currentLocation, locale)}
            </p>
          </div>
        </aside>

        <section className="workspace">
          <div className="workspace-toolbar">
            <div>
              <div className="eyebrow">
                <span className="pulse-dot" />
                {activeSection === 'explore'
                  ? `${t.live} · ${localize(locale, 'live record counts', '当前记录动态计数', '目前記錄動態計數')}`
                  : activeSection === 'matches'
                    ? 'RECIPROCAL ROUTES'
                    : activeSection === 'chats'
                      ? 'PRIVATE CHANNELS'
                      : 'YOUR COLLECTION'}
              </div>
              <h1>
                {activeSection === 'explore'
                  ? t.plaza
                  : activeSection === 'matches'
                    ? t.matches
                    : activeSection === 'chats'
                      ? t.chats
                      : t.saved}
              </h1>
            </div>
            <div className="toolbar-controls">
              {activeSection === 'explore' ? (
                <div className="location-status">
                  <span>
                    <MapPin />{' '}
                    {localize(
                      locale,
                      'My location tag',
                      '我的位置标签',
                      '我的位置標籤',
                    )}
                  </span>
                  <Select
                    value={currentLocationId}
                    onValueChange={(value) => {
                      if (value) void updateLocation(value);
                    }}
                  >
                    <SelectTrigger
                      aria-label={localize(
                        locale,
                        'Set location tag manually',
                        '手动设置位置标签',
                        '手動設定位置標籤',
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {campusLocations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {getCampusLocationLabel(location, locale)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <small>
                    <Clock3 />{' '}
                    {localize(
                      locale,
                      'Manual · no GPS',
                      '手动更新 · 非 GPS',
                      '手動更新 · 非 GPS',
                    )}
                  </small>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setActiveSection('explore')}
                >
                  <Map />{' '}
                  {localize(locale, 'Back to map', '返回地图', '返回地圖')}
                </Button>
              )}
              {activeSection === 'explore' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="bubble-visibility"
                  onClick={() => setShowBubbles((visible) => !visible)}
                  aria-pressed={!showBubbles}
                >
                  {showBubbles ? <EyeOff /> : <Eye />}
                  {showBubbles
                    ? localize(locale, 'Hide pop-ups', '隐藏气泡', '隱藏氣泡')
                    : localize(locale, 'Show pop-ups', '显示气泡', '顯示氣泡')}
                </Button>
              )}
              <div
                className={`view-toggle ${activeSection !== 'explore' ? 'is-hidden' : ''}`}
              >
                <button
                  className={view === 'plaza' ? 'active' : ''}
                  onClick={() => setView('plaza')}
                  aria-label={t.plaza}
                >
                  <Map />
                </button>
                <button
                  className={view === 'list' ? 'active' : ''}
                  onClick={() => setView('list')}
                  aria-label={t.list}
                >
                  <List />
                </button>
              </div>
            </div>
          </div>

          {activeSection === 'explore' && (
            <div
              className="campus-groups"
              aria-label={localize(
                locale,
                'Campus areas',
                '校园分区',
                '校園分區',
              )}
            >
              {locationGroups.map((locationGroup) => (
                <button
                  key={locationGroup.id}
                  className={group === locationGroup.id ? 'active' : ''}
                  onClick={() => setGroup(locationGroup.id)}
                >
                  <strong>
                    {getLocationGroupLabel(locationGroup, locale)}
                  </strong>
                  <span>{locationGroup.labelEn}</span>
                </button>
              ))}
            </div>
          )}

          {view === 'plaza' && activeSection === 'explore' ? (
            <div
              className="plaza-canvas"
              aria-label={localize(
                locale,
                'Campus request map',
                '校园需求地点广场',
                '校園需求地點廣場',
              )}
            >
              <div className="zone-context">
                <strong>
                  {getLocationGroupLabel(
                    locationGroups.find((entry) => entry.id === group)!,
                    locale,
                  )}
                </strong>
                <span>
                  {getLocationGroupDescription(
                    locationGroups.find((entry) => entry.id === group)!,
                    locale,
                  )}
                </span>
              </div>
              <div
                className="canvas-grid campus-canvas-grid"
                style={{ transform: `scale(${zoom})` }}
              >
                {visibleLocations.map((location, index) => {
                  const locationItems = items.filter(
                    (item) => item.locationId === location.id,
                  );
                  const realCount = locationItems.filter(
                    (item) => !item.demo,
                  ).length;
                  const demoCount = locationItems.length - realCount;
                  const countLabel = realCount
                    ? demoCount
                      ? localize(
                          locale,
                          `${realCount} live · ${demoCount} DEMO`,
                          `${realCount} 实际 · ${demoCount} DEMO`,
                          `${realCount} 實際 · ${demoCount} DEMO`,
                        )
                      : localize(
                          locale,
                          `${realCount} requests`,
                          `${realCount} 条需求`,
                          `${realCount} 條需求`,
                        )
                    : demoCount
                      ? `${demoCount} DEMO`
                      : localize(locale, 'No requests', '暂无需求', '暫無需求');
                  return (
                    <button
                      key={location.id}
                      className={`hall-node hall-node-${index % 5}`}
                      style={{
                        left: `${location.x}%`,
                        top: `${location.y}%`,
                        width: location.size,
                        height: location.size,
                      }}
                      onClick={() => setSelectedLocationId(location.id)}
                      aria-label={`${location.label}，${countLabel}`}
                    >
                      <span className="node-orbit" />
                      <strong>
                        {getCampusLocationLabel(location, locale)}
                      </strong>
                      <span>{countLabel}</span>
                    </button>
                  );
                })}
                {showBubbles &&
                  visibleLocations.flatMap((location) => {
                    const anchoredItems = filtered
                      .filter((item) => item.locationId === location.id)
                      .slice(0, 2);
                    return anchoredItems.map((item, index) => {
                      const meta = categoryMeta[item.category];
                      const Icon = meta.icon;
                      const opensLeft = location.x > 62;
                      const rises = location.y > 67;
                      const stackOffset = index * (rises ? -58 : 58);
                      return (
                        <button
                          key={item.id}
                          onClick={() => setSelected(item)}
                          className={`request-bubble anchored-bubble ${opensLeft ? 'opens-left' : 'opens-right'}`}
                          style={
                            {
                              left: `${location.x}%`,
                              top: `${location.y}%`,
                              '--bubble-color': meta.color,
                              '--anchor-radius': `${location.size / 2 + 16}px`,
                              '--stack-offset': `${stackOffset}px`,
                            } as React.CSSProperties
                          }
                        >
                          <span
                            className="bubble-connector"
                            aria-hidden="true"
                          />
                          <span className="request-icon">
                            <Icon />
                          </span>
                          <span>
                            <strong>{item.title}</strong>
                            <small>
                              {item.demo && 'DEMO · '}
                              {getCampusLocationLabel(location, locale)}
                            </small>
                          </span>
                        </button>
                      );
                    });
                  })}
              </div>
              <div className="zoom-controls">
                <button
                  onClick={() => setZoom(Math.min(1.15, zoom + 0.05))}
                  aria-label="Zoom in"
                >
                  <ZoomIn />
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom(Math.max(0.8, zoom - 0.05))}
                  aria-label="Zoom out"
                >
                  <ZoomOut />
                </button>
              </div>
              <p className="canvas-tip">
                {localize(
                  locale,
                  'Select a place to see every request there · Pop-ups stay anchored to their place',
                  '点击地点查看全部需求 · 气泡始终锚定到对应地点',
                  '點擊地點查看全部需求 · 氣泡始終錨定到對應地點',
                )}
              </p>
            </div>
          ) : (
            <div className="request-list">
              {activeSection === 'chats' ? (
                conversations.length ? (
                  conversations.map((conversation) => (
                    <ConversationRow
                      key={conversation.id}
                      conversation={conversation}
                      locale={locale}
                      onClick={() =>
                        openSession({
                          conversationId: conversation.id,
                          peerAlias: conversation.peerAlias,
                          postId: conversation.postId,
                          postTitle: conversation.post?.title ?? '',
                        })
                      }
                    />
                  ))
                ) : (
                  <div className="section-empty">
                    <MessageCircle />
                    <strong>
                      {localize(
                        locale,
                        'No conversations yet',
                        '还没有会话',
                        '還沒有會話',
                      )}
                    </strong>
                    <span>
                      {localize(
                        locale,
                        'Open a request and start chatting; messages you receive appear here.',
                        '打开任意需求发起沟通，收到的消息会出现在这里。',
                        '打開任意需求發起溝通，收到的訊息會出現在這裡。',
                      )}
                    </span>
                  </div>
                )
              ) : sectionItems.length ? (
                sectionItems.map((item) => (
                  <RequestRow
                    key={item.id}
                    item={item}
                    locale={locale}
                    onClick={() => setSelected(item)}
                  />
                ))
              ) : (
                <div className="section-empty">
                  <Sparkles />
                  <strong>
                    {activeSection === 'matches'
                      ? localize(
                          locale,
                          'No reciprocal housing matches yet',
                          '暂时没有双向宿舍匹配',
                          '暫時沒有雙向宿舍配對',
                        )
                      : activeSection === 'saved'
                        ? localize(
                            locale,
                            'Nothing saved yet',
                            '还没有收藏',
                            '還沒有收藏',
                          )
                        : localize(
                            locale,
                            'No matching requests in this area',
                            '这个分区暂时没有符合条件的需求',
                            '這個分區暫時沒有符合條件的需求',
                          )}
                  </strong>
                  <span>
                    {activeSection === 'matches'
                      ? localize(
                          locale,
                          'Publish or update a request and NODE will check for reciprocal routes.',
                          '发布或调整需求后，系统会自动计算路线互补的对象。',
                          '發佈或調整需求後，系統會自動計算路線互補的對象。',
                        )
                      : activeSection === 'saved'
                        ? localize(
                            locale,
                            'Open a request to save it.',
                            '打开需求详情，即可加入收藏。',
                            '打開需求詳情，即可加入收藏。',
                          )
                        : localize(
                            locale,
                            'Try another area or clear the filters.',
                            '切换分区或清除筛选条件后再看看。',
                            '切換分區或清除篩選條件後再看看。',
                          )}
                  </span>
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="right-panel">
          <div className="panel-heading">
            <div>
              <span className="pulse-dot" /> LIVE
            </div>
            <button onClick={() => setView('list')}>
              {localize(locale, 'View all', '查看全部', '查看全部')}{' '}
              <ChevronDown />
            </button>
          </div>
          <AnnouncementBoard announcements={announcements} locale={locale} />
          <div className="panel-title">
            <h2>{localize(locale, 'Happening now', '正在发生', '正在發生')}</h2>
            <span>
              {localize(
                locale,
                `${filtered.length} related requests`,
                `${filtered.length} 个相关需求`,
                `${filtered.length} 個相關需求`,
              )}
            </span>
          </div>
          <div className="activity-list">
            {filtered.slice(0, 4).map((item) => (
              <ActivityCard
                key={item.id}
                item={item}
                locale={locale}
                onClick={() => setSelected(item)}
              />
            ))}
          </div>
          <div className="match-card">
            <div className="match-orbit">
              <ArrowLeftRight />
            </div>
            <Badge>{matchItems.length ? 'MATCH FOUND' : 'MATCHING'}</Badge>
            <h3>
              {matchItems.length
                ? localize(
                    locale,
                    'Reciprocal housing match found',
                    '发现双向宿舍匹配',
                    '發現雙向宿舍配對',
                  )
                : localize(
                    locale,
                    'Checking reciprocal routes',
                    '正在寻找路线互补需求',
                    '正在尋找路線互補需求',
                  )}
            </h3>
            <p>
              {matchItems.length
                ? localize(
                    locale,
                    `${matchItems[0].from} → ${matchItems[0].to} has a reciprocal request.`,
                    `${matchItems[0].from} → ${matchItems[0].to} 已找到反向需求。`,
                    `${matchItems[0].from} → ${matchItems[0].to} 已找到反向需求。`,
                  )
                : localize(
                    locale,
                    'New reciprocal routes appear automatically in My matches.',
                    '有新的互补路线时，会自动出现在“我的匹配”。',
                    '有新的互補路線時，會自動出現在「我的配對」。',
                  )}
            </p>
            <Button
              onClick={() => {
                setActiveSection('matches');
                setView('list');
              }}
            >
              {localize(locale, 'View matches', '查看匹配', '查看配對')}
            </Button>
          </div>
          <a href="/rules" className="policy-note">
            <ShieldCheck /> {t.notice}
          </a>
        </aside>
      </div>

      <nav className="mobile-nav">
        <RailLink
          icon={Map}
          label={t.explore}
          active={activeSection === 'explore'}
          onClick={() => setActiveSection('explore')}
        />
        <RailLink
          icon={Sparkles}
          label={t.matches}
          count={matchItems.length || undefined}
          active={activeSection === 'matches'}
          onClick={() => {
            setActiveSection('matches');
            setView('list');
          }}
        />
        <button
          className="mobile-create"
          aria-label={t.post}
          onClick={() => setCreateOpen(true)}
        >
          <Plus />
        </button>
        <RailLink
          icon={MessageCircle}
          label={t.chats}
          count={conversations.length || undefined}
          active={activeSection === 'chats'}
          onClick={() => {
            setActiveSection('chats');
            setView('list');
          }}
        />
        <button className="rail-link" onClick={() => setProfileOpen(true)}>
          <UserRound />
          <span>Me</span>
        </button>
      </nav>
      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <SheetContent className="detail-sheet">
          {selected && (
            <RequestDetail
              item={selected}
              t={t}
              locale={locale}
              onChat={() => void ensureThread(selected)}
              saved={savedIds.has(String(selected.id))}
              onSave={() => toggleSaved(selected)}
              onReport={async () => {
                try {
                  const response = await fetch('/api/reports', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                      targetType: 'post',
                      targetId: String(selected.id),
                      reason: 'other',
                      details: null,
                    }),
                  });
                  if (!response.ok) throw new Error('report failed');
                  setNotice(
                    localize(
                      locale,
                      'Report submitted to the moderation queue.',
                      '举报已提交到管理员队列。',
                      '舉報已提交到管理員隊列。',
                    ),
                  );
                } catch {
                  setNotice(
                    localize(
                      locale,
                      'Could not submit the report. Please try again.',
                      '举报提交失败，请稍后再试。',
                      '舉報提交失敗，請稍後再試。',
                    ),
                  );
                }
                setSelected(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
      <Sheet
        open={Boolean(selectedLocation)}
        onOpenChange={(open) => !open && setSelectedLocationId(null)}
      >
        <SheetContent className="location-sheet">
          {selectedLocation && (
            <>
              <SheetHeader className="location-sheet-header">
                <div className="detail-category">
                  <MapPin />{' '}
                  {getLocationGroupLabel(
                    locationGroups.find(
                      (entry) => entry.id === selectedLocation.group,
                    )!,
                    locale,
                  )}
                </div>
                <SheetTitle>
                  {getCampusLocationLabel(selectedLocation, locale, false)}
                </SheetTitle>
                <SheetDescription>
                  {selectedLocationItems.length
                    ? localize(
                        locale,
                        `${selectedLocationItems.length} current records here. Demo content is labelled DEMO.`,
                        `这里共有 ${selectedLocationItems.length} 条当前记录；演示内容均标有 DEMO。`,
                        `這裡共有 ${selectedLocationItems.length} 條目前記錄；演示內容均標有 DEMO。`,
                      )
                    : localize(
                        locale,
                        'No requests here yet. You can be the first to post.',
                        '这里暂时没有需求；你可以成为第一个发布者。',
                        '這裡暫時沒有需求；你可以成為第一個發佈者。',
                      )}
                </SheetDescription>
              </SheetHeader>
              <div className="location-request-list">
                {selectedLocationItems.length ? (
                  selectedLocationItems.map((item) => (
                    <RequestRow
                      key={item.id}
                      item={item}
                      locale={locale}
                      onClick={() => {
                        setSelectedLocationId(null);
                        setSelected(item);
                      }}
                    />
                  ))
                ) : (
                  <div className="section-empty compact">
                    <MapPin />
                    <strong>
                      {localize(locale, 'No requests', '暂无需求', '暫無需求')}
                    </strong>
                    <span>
                      {localize(
                        locale,
                        'The count is zero; NODE never fills it with placeholder numbers.',
                        '地点计数为 0；不会用占位数字填充。',
                        '地點計數為 0；不會用佔位數字填充。',
                      )}
                    </span>
                  </div>
                )}
              </div>
              <Button
                className="location-post-button"
                onClick={() => {
                  void updateLocation(selectedLocation.id);
                  setSelectedLocationId(null);
                  setCreateOpen(true);
                }}
              >
                <Plus />{' '}
                {localize(
                  locale,
                  'Post from this place',
                  '在这里发布需求',
                  '在這裡發佈需求',
                )}
              </Button>
            </>
          )}
        </SheetContent>
      </Sheet>
      <Sheet
        open={Boolean(chatSession)}
        onOpenChange={(open) => {
          if (!open) {
            setChatSession(null);
            void loadConversations();
          }
        }}
      >
        <SheetContent className="chat-sheet">
          {chatSession && (
            <ChatPanel
              key={chatSession.conversationId}
              session={chatSession}
              myAlias={profile?.anonymousAlias ?? ''}
              onConversationChanged={() => void loadConversations()}
              locale={locale}
            />
          )}
        </SheetContent>
      </Sheet>
      <Sheet open={adminOpen} onOpenChange={setAdminOpen}>
        <SheetContent className="admin-sheet">
          <AdminPanel
            locale={locale}
            isOwner={profile?.role === 'owner'}
            onAnnouncementPublished={(announcement) =>
              setAnnouncements((current) => [announcement, ...current])
            }
          />
        </SheetContent>
      </Sheet>
      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent className="profile-sheet">
          <ProfilePanel
            locale={locale}
            profile={profile}
            onSaved={() => void reloadProfile()}
          />
        </SheetContent>
      </Sheet>
      {notice && (
        <output className="app-notice" aria-live="polite">
          <CheckCircle2 />
          {notice}
          <button
            onClick={() => setNotice('')}
            aria-label={localize(locale, 'Close', '关闭', '關閉')}
          >
            <X />
          </button>
        </output>
      )}
    </main>
  );
}

function AnnouncementBoard({
  announcements,
  locale,
}: {
  announcements: Announcement[];
  locale: Locale;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? announcements : announcements.slice(0, 1);
  return (
    <section className="announcement-board" aria-label="Announcements">
      <div className="announcement-heading">
        <span>
          <Megaphone /> {localize(locale, 'Announcements', '公告栏', '公告欄')}
        </span>
        {announcements.length > 1 && (
          <button onClick={() => setExpanded((value) => !value)}>
            {expanded
              ? localize(locale, 'Collapse', '收起', '收起')
              : localize(
                  locale,
                  `View all ${announcements.length}`,
                  `查看全部 ${announcements.length} 条`,
                  `查看全部 ${announcements.length} 條`,
                )}
          </button>
        )}
      </div>
      {visible.length ? (
        visible.map((announcement) => (
          <article
            key={announcement.id}
            className={`announcement-item announcement-${announcement.kind}`}
          >
            <Badge variant="secondary">{announcement.kind}</Badge>
            <strong>{announcement.title}</strong>
            <p>{announcement.body}</p>
          </article>
        ))
      ) : (
        <p className="announcement-empty">
          {localize(
            locale,
            'No active announcements.',
            '当前没有公告。',
            '目前沒有公告。',
          )}
        </p>
      )}
    </section>
  );
}

function RailLink({
  icon: Icon,
  label,
  active,
  count,
  onClick,
}: {
  icon: typeof Map;
  label: string;
  active?: boolean;
  count?: string | number;
  onClick?: () => void;
}) {
  return (
    <button className={`rail-link ${active ? 'active' : ''}`} onClick={onClick}>
      <Icon />
      <span>{label}</span>
      {count && <b>{count}</b>}
    </button>
  );
}
function FilterButton({
  icon: Icon,
  label,
  color,
  active,
  onClick,
}: {
  icon: typeof Map;
  label: string;
  color?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`filter-button ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <span style={{ background: color || '#96a6ff' }}>
        <Icon />
      </span>
      {label}
    </button>
  );
}

function ActivityCard({
  item,
  locale,
  onClick,
}: {
  item: RequestItem;
  locale: Locale;
  onClick: () => void;
}) {
  const meta = categoryMeta[item.category];
  const Icon = meta.icon;
  return (
    <button className="activity-card" onClick={onClick}>
      <span
        className="activity-icon"
        style={{ background: `${meta.color}20`, color: meta.color }}
      >
        <Icon />
      </span>
      <span className="activity-copy">
        <strong>{item.title}</strong>
        <small>
          {item.demo && 'DEMO · '}
          {getCampusLocationLabel(
            getCampusLocation(item.locationId),
            locale,
          )} ·{' '}
          {item.age}
        </small>
      </span>
      <span className="reply-count">
        <MessageCircle /> {item.replies}
      </span>
    </button>
  );
}
function RequestRow({
  item,
  locale,
  onClick,
}: {
  item: RequestItem;
  locale: Locale;
  onClick: () => void;
}) {
  const meta = categoryMeta[item.category];
  const Icon = meta.icon;
  return (
    <button className="request-row" onClick={onClick}>
      <span style={{ color: meta.color }}>
        <Icon />
      </span>
      <div>
        <strong>{item.title}</strong>
        <p>{item.detail}</p>
        <small>
          {item.demo && 'DEMO · '}
          {getCampusLocationLabel(
            getCampusLocation(item.locationId),
            locale,
          )} ·{' '}
          {item.author} · {item.age} · {item.replies} replies
        </small>
      </div>
      <ChevronDown />
    </button>
  );
}

function ConversationRow({
  conversation,
  locale,
  onClick,
}: {
  conversation: ConversationItem;
  locale: Locale;
  onClick: () => void;
}) {
  const last = conversation.lastMessage;
  const preview = !last
    ? localize(locale, 'No messages yet', '还没有消息', '還沒有訊息')
    : last.kind === 'contact_reveal'
      ? localize(
          locale,
          'Contact exchanged · details shared in chat',
          '已互相交换联系方式，详情见会话',
          '已互相交換聯絡方式，詳情見會話',
        )
      : last.kind === 'contact_request'
        ? localize(
            locale,
            last.isMine
              ? 'Contact exchange request sent · waiting for reply'
              : 'They want to exchange contact details',
            last.isMine
              ? '已发送联系方式交换请求 · 等待对方确认'
              : '对方请求交换联系方式',
            last.isMine
              ? '已發送聯絡方式交換請求 · 等待對方確認'
              : '對方請求交換聯絡方式',
          )
        : last.body;
  const context = conversation.post?.title
    ? ` · ${conversation.post.title}`
    : '';
  return (
    <button className="request-row" onClick={onClick}>
      <span style={{ color: '#96a6ff' }}>
        <MessageCircle />
      </span>
      <div>
        <strong>
          {conversation.peerAlias}
          {context}
        </strong>
        <p>{preview}</p>
        <small>
          {last
            ? `${last.isMine ? localize(locale, 'You', '我', '我') + ' · ' : ''}${formatClock(last.createdAt)}`
            : ''}
        </small>
      </div>
      <ChevronDown />
    </button>
  );
}

function RequestDetail({
  item,
  t,
  locale,
  onChat,
  saved,
  onSave,
  onReport,
}: {
  item: RequestItem;
  t: (typeof copy)[Locale];
  locale: Locale;
  onChat: () => void;
  saved: boolean;
  onSave: () => void;
  onReport: () => void;
}) {
  const meta = categoryMeta[item.category];
  const Icon = meta.icon;
  return (
    <>
      <SheetHeader className="detail-header">
        <div className="detail-category" style={{ color: meta.color }}>
          <Icon /> {t[item.category]}
        </div>
        <SheetTitle>{item.title}</SheetTitle>
        <SheetDescription>
          {localize(
            locale,
            `Posted by ${item.author} · ${item.age} ago`,
            `由 ${item.author} 发布 · ${item.age} 前`,
            `由 ${item.author} 發佈 · ${item.age} 前`,
          )}
        </SheetDescription>
      </SheetHeader>
      <div className="detail-body">
        {item.category === 'hall' && (
          <div className="swap-route">
            <div>
              <small>{localize(locale, 'Current', '当前', '目前')}</small>
              <strong>{item.from}</strong>
            </div>
            <ArrowLeftRight />
            <div>
              <small>{localize(locale, 'Wanted', '目标', '目標')}</small>
              <strong>{item.to}</strong>
            </div>
          </div>
        )}
        <div className="request-location-card">
          <MapPin />
          <div>
            <small>
              {localize(locale, 'Posted from', '发布地点', '發佈地點')}
            </small>
            <strong>
              {getCampusLocationLabel(
                getCampusLocation(item.locationId),
                locale,
                false,
              ) || localize(locale, 'No location', '未设置地点', '未設定地點')}
            </strong>
          </div>
          {item.demo && <Badge variant="secondary">DEMO</Badge>}
        </div>
        <p>{item.detail}</p>
        <div className="safety-box">
          <ShieldCheck />
          <div>
            <strong>
              {localize(
                locale,
                'Privacy protection is on',
                '隐私保护已开启',
                '私隱保護已開啟',
              )}
            </strong>
            <p>
              {localize(
                locale,
                'Real names, email addresses and contact details stay hidden until both people consent.',
                '双方同意前，真实姓名、邮箱及联系方式都不会展示。',
                '雙方同意前，真實姓名、電郵及聯絡方式都不會展示。',
              )}
            </p>
          </div>
        </div>
        <div className="detail-actions">
          <Button size="lg" onClick={onChat}>
            <MessageCircle /> {t.chat}
          </Button>
          <Button variant="outline" size="lg" onClick={onSave}>
            <Bookmark fill={saved ? 'currentColor' : 'none'} />
            {saved
              ? localize(locale, 'Saved', '已收藏', '已收藏')
              : localize(locale, 'Save', '收藏', '收藏')}
          </Button>
          <Button variant="outline" size="lg" onClick={onReport}>
            <Flag /> {t.report}
          </Button>
        </div>
      </div>
    </>
  );
}

function FeedbackDialog({
  locale,
  onClose,
  onSent,
}: {
  locale: Locale;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const [category, setCategory] = useState<FeedbackCategory>('suggestion');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category, body: text }),
      });
      if (!response.ok) throw new Error('send failed');
      onSent(
        localize(
          locale,
          'Feedback sent. Thank you!',
          '反馈已发送，谢谢！',
          '反饋已送出，多謝！',
        ),
      );
    } catch {
      setError(
        localize(
          locale,
          'Could not send feedback. Please try again.',
          '发送失败，请稍后再试。',
          '傳送失敗，請稍後再試。',
        ),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <DialogContent className="create-dialog">
      <DialogHeader>
        <DialogTitle>
          {localize(locale, 'Send feedback', '发送反馈', '發送反饋')}
        </DialogTitle>
        <DialogDescription>
          {localize(
            locale,
            'Tell the NODE team what to fix or improve. Your username is visible to the Owner only — other members stay anonymous.',
            '告诉我们如何改进 NODE。你的用户名只对 Owner 可见，对其他成员保持匿名。',
            '話畀我哋知點樣改進 NODE。你嘅用戶名只對 Owner 可見，其他成員保持匿名。',
          )}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={(event) => void submit(event)}>
        <div className="create-form">
          <div className="form-field">
            <label htmlFor="feedback-category">
              {localize(locale, 'Type', '类型', '類型')}
            </label>
            <Select
              value={category}
              onValueChange={(value) =>
                setCategory(value as FeedbackCategory)
              }
            >
              <SelectTrigger id="feedback-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">
                  {feedbackCategoryLabel('bug', locale)}
                </SelectItem>
                <SelectItem value="suggestion">
                  {feedbackCategoryLabel('suggestion', locale)}
                </SelectItem>
                <SelectItem value="other">
                  {feedbackCategoryLabel('other', locale)}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="form-field">
            <label htmlFor="feedback-body">
              {localize(locale, 'Feedback', '反馈内容', '反饋內容')}
            </label>
            <Textarea
              id="feedback-body"
              required
              rows={5}
              maxLength={2000}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={localize(
                locale,
                'Describe the issue or your suggestion…',
                '描述问题或建议…',
                '描述問題或建議…',
              )}
            />
            <small className="field-hint">{body.length}/2000</small>
          </div>
          {error && <div className="queue-error">{error}</div>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {localize(locale, 'Cancel', '取消', '取消')}
          </Button>
          <Button type="submit" disabled={!body.trim() || sending}>
            {sending
              ? localize(locale, 'Sending…', '发送中…', '傳送中…')
              : localize(locale, 'Send feedback', '发送反馈', '發送反饋')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function CreatePostDialog({
  t,
  locale,
  onCreated,
  currentLocationId,
  authorAlias,
}: {
  t: (typeof copy)[Locale];
  locale: Locale;
  onCreated: (item: RequestItem) => void;
  currentLocationId: string;
  authorAlias: string;
}) {
  const [postCategory, setPostCategory] =
    useState<Exclude<Category, 'all'>>('hall');
  return (
    <DialogContent className="create-dialog">
      <DialogHeader>
        <DialogTitle>{t.post}</DialogTitle>
        <DialogDescription>
          {localize(
            locale,
            'Share only what a match needs. Do not post room numbers, student IDs or contact details.',
            '只填写匹配所需信息；房号、学号和联系方式请勿公开。',
            '只填寫配對所需資訊；房號、學號和聯絡方式請勿公開。',
          )}
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const fromValue = data.get('from');
          const toValue = data.get('to');
          const titleValue = data.get('title');
          const detailValue = data.get('detail');
          const locationValue = data.get('locationId');
          const from = typeof fromValue === 'string' ? fromValue : '';
          const to = typeof toValue === 'string' ? toValue : '';
          onCreated({
            id: Date.now(),
            author: authorAlias,
            category: postCategory,
            from,
            to,
            hall: from.replace('Hall ', '') || 'I',
            title:
              typeof titleValue === 'string'
                ? titleValue
                : localize(
                    locale,
                    'New anonymous request',
                    '新的匿名需求',
                    '新的匿名需求',
                  ),
            detail: typeof detailValue === 'string' ? detailValue : '',
            age: 'now',
            replies: 0,
            mine: true,
            locationId:
              typeof locationValue === 'string'
                ? locationValue
                : currentLocationId,
          });
        }}
      >
        <div className="create-form">
          <div className="form-field">
            <label htmlFor="post-category">
              {localize(locale, 'Request type', '需求类型', '需求類型')}
            </label>
            <Select
              value={postCategory}
              onValueChange={(value) =>
                setPostCategory(value as Exclude<Category, 'all'>)
              }
            >
              <SelectTrigger id="post-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hall">{t.hall}</SelectItem>
                <SelectItem value="goods">{t.goods}</SelectItem>
                <SelectItem value="study">{t.study}</SelectItem>
                <SelectItem value="other">{t.other}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="form-field">
            <label htmlFor="post-location">
              {localize(locale, 'Location', '发布地点', '發佈地點')}
            </label>
            <Select name="locationId" defaultValue={currentLocationId}>
              <SelectTrigger id="post-location">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {campusLocations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {getCampusLocationLabel(location, locale)} ·{' '}
                    {getLocationGroupLabel(
                      locationGroups.find(
                        (entry) => entry.id === location.group,
                      )!,
                      locale,
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <small className="field-hint">
              {localize(
                locale,
                'Manual location tag; GPS is never used.',
                '手动地点标签，不读取 GPS。',
                '手動地點標籤，不讀取 GPS。',
              )}
            </small>
          </div>
          {postCategory === 'hall' && (
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="post-from">
                  {localize(locale, 'Current hall', '当前宿舍', '目前宿舍')}
                </label>
                <Input
                  id="post-from"
                  name="from"
                  required
                  placeholder="Hall VII"
                />
              </div>
              <div className="form-field">
                <label htmlFor="post-to">
                  {localize(locale, 'Wanted hall', '目标宿舍', '目標宿舍')}
                </label>
                <Input id="post-to" name="to" required placeholder="Hall III" />
              </div>
            </div>
          )}
          <div className="form-field">
            <label htmlFor="post-title">
              {localize(locale, 'Title', '标题', '標題')}
            </label>
            <Input
              id="post-title"
              name="title"
              required
              maxLength={100}
              placeholder={localize(
                locale,
                'Describe your request in one line',
                '一句话说明你的需求',
                '一句話說明你的需求',
              )}
            />
          </div>
          <div className="form-field">
            <label htmlFor="post-detail">
              {localize(locale, 'Details', '补充说明', '補充說明')}
            </label>
            <Textarea
              id="post-detail"
              name="detail"
              required
              maxLength={2000}
              placeholder={localize(
                locale,
                'Room type, timing and other essential conditions…',
                '房型、时间与其他必要条件…',
                '房型、時間與其他必要條件…',
              )}
            />
          </div>
          <div className="rules-reminder">
            <ShieldCheck />
            <p>
              <strong>
                {localize(
                  locale,
                  'Publishing means you accept the community rules',
                  '发布即表示同意社区规则',
                  '發佈即表示同意社群規則',
                )}
              </strong>
              <br />
              {localize(
                locale,
                'Illegal content, bedspace trading, fraud, harassment, hate, sexual content, privacy leaks and unauthorised promotion are prohibited.',
                '禁止违法违规、床位交易、诈骗、骚扰、仇恨、色情、泄露隐私及未经许可的商业推广。',
                '禁止違法違規、床位交易、詐騙、騷擾、仇恨、色情、洩露私隱及未經許可的商業推廣。',
              )}{' '}
              <a href="/rules">
                {localize(
                  locale,
                  'Read all rules',
                  '查看完整规则',
                  '查看完整規則',
                )}
              </a>
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline">
            {localize(locale, 'Save draft', '保存草稿', '儲存草稿')}
          </Button>
          <Button type="submit">
            <Plus /> {localize(locale, 'Publish', '发布到广场', '發佈到廣場')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function ChatPanel({
  session,
  myAlias,
  onConversationChanged,
  locale,
}: {
  session: ChatSession;
  myAlias: string;
  onConversationChanged: () => void;
  locale: Locale;
}) {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<WireMessage[]>([]);
  const [busy, setBusy] = useState<'sending' | 'requesting' | 'accepting' | null>(
    null,
  );
  const [actionError, setActionError] = useState('');
  const streamRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    try {
      const response = await fetch(
        `/api/conversations/${session.conversationId}/messages`,
      );
      if (!response.ok) return;
      const result = (await response.json()) as { items?: WireMessage[] };
      setMessages(result.items ?? []);
    } catch {
      /* Keep what we have; the next poll retries. */
    }
  };

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.conversationId]);

  // Keep the newest message in view as the other side replies.
  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy('sending');
    setActionError('');
    try {
      const response = await fetch(
        `/api/conversations/${session.conversationId}/messages`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ body }),
        },
      );
      if (!response.ok) throw new Error('send failed');
      setDraft('');
      onConversationChanged();
      await load();
    } catch {
      setActionError(
        localize(
          locale,
          'Could not send the message. Please try again.',
          '消息发送失败，请重试。',
          '訊息發送失敗，請重試。',
        ),
      );
    } finally {
      setBusy(null);
    }
  };

  const requestExchange = async () => {
    if (busy) return;
    setBusy('requesting');
    setActionError('');
    try {
      const response = await fetch(
        `/api/conversations/${session.conversationId}/contact`,
        { method: 'POST', headers: { 'content-type': 'application/json' } },
      );
      if (!response.ok) throw new Error('request failed');
      onConversationChanged();
      await load();
    } catch {
      setActionError(
        localize(
          locale,
          'Could not send the exchange request.',
          '暂时无法发起交换请求。',
          '暫時無法發起交換請求。',
        ),
      );
    } finally {
      setBusy(null);
    }
  };

  const acceptExchange = async () => {
    if (busy) return;
    setBusy('accepting');
    setActionError('');
    try {
      const response = await fetch(
        `/api/conversations/${session.conversationId}/contact`,
        { method: 'PATCH', headers: { 'content-type': 'application/json' } },
      );
      if (!response.ok) throw new Error('accept failed');
      onConversationChanged();
      await load();
    } catch {
      setActionError(
        localize(
          locale,
          'Could not accept the exchange request.',
          '暂时无法确认交换请求。',
          '暫時無法確認交換請求。',
        ),
      );
    } finally {
      setBusy(null);
    }
  };

  const reveals = messages.filter((message) => message.kind === 'contact_reveal');
  const inboundRequest = messages.find(
    (message) => message.kind === 'contact_request' && !message.isMine,
  );
  const outboundRequest = messages.find(
    (message) => message.kind === 'contact_request' && message.isMine,
  );
  const revealed = reveals.length > 0;
  const thread = messages.filter((message) => message.kind === 'message');

  return (
    <>
      <SheetHeader className="chat-header">
        <div className="chat-peer">
          <div className="mini-avatar">{session.peerAlias.slice(0, 1)}</div>
          <div>
            <SheetTitle>{session.peerAlias}</SheetTitle>
            <SheetDescription>
              <span className="pulse-dot" />{' '}
              {localize(
                locale,
                'Anonymous chat · Online',
                '匿名会话 · 在线',
                '匿名會話 · 在線',
              )}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>
      <div className="chat-context">
        <ArrowLeftRight />
        <span>
          <small>
            {localize(
              locale,
              'Request in this chat',
              '讨论中的需求',
              '討論中的需求',
            )}
          </small>
          <strong>{session.postTitle}</strong>
        </span>
      </div>
      <div className="message-stream" ref={streamRef}>
        <div className="system-message">
          <ShieldCheck />{' '}
          {localize(
            locale,
            'NODE keeps real identities hidden until both people consent.',
            '双方同意前，平台不会显示任何真实资料',
            '雙方同意前，平台不會顯示任何真實資料',
          )}
        </div>
        {revealed && (
          <div className="system-message">
            <CheckCircle2 />{' '}
            {localize(
              locale,
              'Contact details have been exchanged.',
              '双方已互相交换联系方式。',
              '雙方已互相交換聯絡方式。',
            )}
          </div>
        )}
        {thread.length === 0 ? (
          <div className="section-empty compact">
            <MessageCircle />
            <strong>
              {localize(
                locale,
                'No messages yet',
                '还没有消息',
                '還沒有訊息',
              )}
            </strong>
            <span>
              {localize(
                locale,
                'Say hello to start the conversation.',
                '发一条消息开始对话吧。',
                '發一則訊息開始對話吧。',
              )}
            </span>
          </div>
        ) : (
          thread.map((message) => (
            <div
              key={message.id}
              className={`message-bubble ${message.isMine ? 'mine' : ''}`}
            >
              <p>{message.body}</p>
              <span>{formatClock(message.createdAt)}</span>
            </div>
          ))
        )}
      </div>
      <div className="contact-consent">
        {revealed ? (
          <>
            <CheckCircle2 />
            <span>
              <strong>
                {localize(
                  locale,
                  'Contact details shared',
                  '联系方式已互相公开',
                  '聯絡方式已互相公開',
                )}
              </strong>
              <small>
                {localize(
                  locale,
                  'You can now reach each other outside NODE.',
                  '现在可以在平台外直接联系对方。',
                  '現在可以在平台外直接聯絡對方。',
                )}
              </small>
              {reveals.map((message) => (
                <code key={message.id} className="reveal-block">
                  <b>{message.alias}</b>
                  <span>{message.body}</span>
                </code>
              ))}
            </span>
          </>
        ) : inboundRequest ? (
          <>
            <UserPlus />
            <span>
              <strong>
                {localize(
                  locale,
                  'They want to exchange contact details',
                  '对方请求交换联系方式',
                  '對方請求交換聯絡方式',
                )}
              </strong>
              <small>
                {localize(
                  locale,
                  'Accepting reveals both sides’ contact details.',
                  '确认后双方将互相看到联系方式。',
                  '確認後雙方將互相看到聯絡方式。',
                )}
              </small>
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={busy === 'accepting'}
              onClick={() => void acceptExchange()}
            >
              {busy === 'accepting'
                ? localize(locale, 'Accepting…', '确认中…', '確認中…')
                : localize(locale, 'Accept', '同意交换', '同意交換')}
            </Button>
          </>
        ) : outboundRequest ? (
          <>
            <Clock3 />
            <span>
              <strong>
                {localize(locale, 'Request sent', '请求已发送', '請求已發送')}
              </strong>
              <small>
                {localize(
                  locale,
                  'Waiting for the other person to confirm.',
                  `等待 ${session.peerAlias} 确认。`,
                  `等待 ${session.peerAlias} 確認。`,
                )}
              </small>
            </span>
          </>
        ) : (
          <>
            <UserPlus />
            <span>
              <strong>
                {localize(
                  locale,
                  'Continue outside NODE?',
                  '需要转到校外联系？',
                  '需要轉到站外聯絡？',
                )}
              </strong>
              <small>
                {localize(
                  locale,
                  'Both people must confirm separately. Save your contact in your profile first.',
                  '必须双方分别确认。请先在个人资料里填写你的联系方式。',
                  '必須雙方分別確認。請先在個人資料裡填寫你的聯絡方式。',
                )}
              </small>
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={busy === 'requesting' || !myAlias}
              onClick={() => void requestExchange()}
            >
              {busy === 'requesting'
                ? localize(locale, 'Sending…', '发送中…', '傳送中…')
                : localize(locale, 'Request exchange', '发起交换', '發起交換')}
            </Button>
          </>
        )}
        {actionError && <span className="consent-error">{actionError}</span>}
      </div>
      <div className="chat-composer">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder={localize(
            locale,
            'Write an anonymous message…',
            '输入匿名消息…',
            '輸入匿名訊息…',
          )}
        />
        <Button
          size="icon-lg"
          onClick={() => void send()}
          disabled={busy === 'sending' || !draft.trim()}
          aria-label={localize(locale, 'Send', '发送', '發送')}
        >
          <Send />
        </Button>
      </div>
    </>
  );
}

function AdminPanel({
  locale,
  isOwner,
  onAnnouncementPublished,
}: {
  locale: Locale;
  isOwner: boolean;
  onAnnouncementPublished: (announcement: Announcement) => void;
}) {
  const [queue, setQueue] = useState<AdminReport[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [queueError, setQueueError] = useState('');
  const [inviteSent, setInviteSent] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementKind, setAnnouncementKind] =
    useState<Announcement['kind']>('info');
  const [announcementStatus, setAnnouncementStatus] = useState('');
  const [feedbackItems, setFeedbackItems] = useState<AdminFeedback[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [feedbackFilter, setFeedbackFilter] = useState<
    'all' | 'open' | 'resolved'
  >('all');
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackActingId, setFeedbackActingId] = useState<string | null>(null);

  const loadReports = async () => {
    try {
      const response = await fetch('/api/admin/reports');
      if (!response.ok) throw new Error('load failed');
      const result = (await response.json()) as { items?: AdminReport[] };
      setQueue(result.items ?? []);
      setQueueError('');
    } catch {
      setQueueError(
        localize(
          locale,
          'Could not load the review queue.',
          '无法读取审核队列。',
          '無法讀取審核隊列。',
        ),
      );
    } finally {
      setQueueLoading(false);
    }
  };

  const loadFeedback = async () => {
    try {
      const response = await fetch('/api/feedback');
      if (!response.ok) throw new Error('load failed');
      const result = (await response.json()) as { items?: AdminFeedback[] };
      setFeedbackItems(result.items ?? []);
      setFeedbackError('');
    } catch {
      setFeedbackError(
        localize(
          locale,
          'Could not load feedback.',
          '无法读取反馈。',
          '無法讀取反饋。',
        ),
      );
    } finally {
      setFeedbackLoading(false);
    }
  };

  const toggleFeedback = async (item: AdminFeedback) => {
    const action = item.status === 'open' ? 'resolve' : 'reopen';
    setFeedbackActingId(item.id);
    setFeedbackError('');
    try {
      const response = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: item.id, action }),
      });
      if (!response.ok) throw new Error('toggle failed');
      setFeedbackItems((items) =>
        items.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                status: action === 'resolve' ? 'resolved' : 'open',
                resolvedAt:
                  action === 'resolve' ? new Date().toISOString() : null,
              }
            : entry,
        ),
      );
    } catch {
      setFeedbackError(
        localize(
          locale,
          'Could not update that feedback.',
          '更新失败，请稍后再试。',
          '更新失敗，請稍後再試。',
        ),
      );
    } finally {
      setFeedbackActingId(null);
    }
  };

  useEffect(() => {
    void loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isOwner) {
      void loadFeedback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);

  const act = async (report: AdminReport, action: 'remove' | 'dismiss') => {
    setActingId(report.id);
    setQueueError('');
    try {
      const response = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          reportId: report.id,
          action,
          reason:
            action === 'remove'
              ? 'Owner removed this content for a community-standards violation.'
              : 'No action needed — report dismissed by the moderation team.',
        }),
      });
      if (!response.ok) throw new Error('action failed');
      setQueue((items) => items.filter((item) => item.id !== report.id));
    } catch {
      setQueueError(
        localize(
          locale,
          'Could not process that report. Please try again.',
          '处理失败，请稍后再试。',
          '處理失敗，請稍後再試。',
        ),
      );
    } finally {
      setActingId(null);
    }
  };
  const publishAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementBody.trim()) return;
    setAnnouncementStatus('publishing');
    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: announcementTitle,
          body: announcementBody,
          kind: announcementKind,
        }),
      });
      const result = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error);
      onAnnouncementPublished({
        id: result.id,
        title: announcementTitle.trim(),
        body: announcementBody.trim(),
        kind: announcementKind,
        publishedAt: new Date().toISOString(),
        authorAlias: 'NODE Team',
      });
      setAnnouncementTitle('');
      setAnnouncementBody('');
      setAnnouncementStatus('published');
    } catch {
      setAnnouncementStatus('error');
    }
  };
  return (
    <div className="admin-scroll">
      <SheetHeader className="admin-header">
        <div className="detail-category">
          <Gavel /> OWNER CONSOLE
        </div>
        <SheetTitle>
          {localize(locale, 'Moderation', '管理中心', '管理中心')}
        </SheetTitle>
        <SheetDescription>
          {localize(
            locale,
            'You are the founding Owner. Publish notices, invite moderators and manage reports.',
            '你是首位 Owner，可发布公告、邀请管理员并处理举报。',
            '你是首位 Owner，可發佈公告、邀請管理員並處理舉報。',
          )}
        </SheetDescription>
      </SheetHeader>
      <div className="admin-metrics">
        <div>
          <strong>{queue.length}</strong>
          <span>
            {localize(locale, 'Open reports', '待处理举报', '待處理舉報')}
          </span>
        </div>
        <div>
          <strong>2</strong>
          <span>
            {localize(locale, 'Auto-blocked', '自动拦截', '自動攔截')}
          </span>
        </div>
        <div>
          <strong>18m</strong>
          <span>
            {localize(
              locale,
              'Average response',
              '平均处理时间',
              '平均處理時間',
            )}
          </span>
        </div>
      </div>
      <section className="announcement-admin-card">
        <div className="admin-section-title">
          <h3>
            <Megaphone />{' '}
            {localize(
              locale,
              'Publish an announcement',
              '发布公告',
              '發佈公告',
            )}
          </h3>
          <Badge>LIVE BOARD</Badge>
        </div>
        <Select
          value={announcementKind}
          onValueChange={(value) => {
            if (value) setAnnouncementKind(value as Announcement['kind']);
          }}
        >
          <SelectTrigger aria-label="Announcement type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="info">Information</SelectItem>
            <SelectItem value="upgrade">Upgrade</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={announcementTitle}
          onChange={(event) => setAnnouncementTitle(event.target.value)}
          maxLength={100}
          placeholder={localize(
            locale,
            'Announcement title',
            '公告标题',
            '公告標題',
          )}
        />
        <Textarea
          value={announcementBody}
          onChange={(event) => setAnnouncementBody(event.target.value)}
          maxLength={800}
          placeholder={localize(
            locale,
            'What does the community need to know?',
            '需要向社区说明什么？',
            '需要向社群說明甚麼？',
          )}
        />
        <div className="announcement-admin-actions">
          <Button
            onClick={publishAnnouncement}
            disabled={
              announcementStatus === 'publishing' ||
              !announcementTitle.trim() ||
              !announcementBody.trim()
            }
          >
            <Megaphone />{' '}
            {announcementStatus === 'publishing'
              ? localize(locale, 'Publishing…', '发布中…', '發佈中…')
              : localize(locale, 'Publish now', '立即发布', '立即發佈')}
          </Button>
          {announcementStatus === 'published' && (
            <span>
              {localize(locale, 'Published.', '已发布。', '已發佈。')}
            </span>
          )}
          {announcementStatus === 'error' && (
            <span className="error">
              {localize(
                locale,
                'Could not publish.',
                '发布失败。',
                '發佈失敗。',
              )}
            </span>
          )}
        </div>
      </section>
      <div className="admin-section-title">
        <h3>{localize(locale, 'Review queue', '审核队列', '審核隊列')}</h3>
        <Badge>{queue.length} OPEN</Badge>
      </div>
      {queueError && <div className="queue-error">{queueError}</div>}
      <div className="moderation-queue">
        {queueLoading ? (
          <div className="queue-empty">
            <strong>
              {localize(locale, 'Loading…', '加载中…', '載入中…')}
            </strong>
          </div>
        ) : queue.length ? (
          queue.map((report) => {
            const severe = [
              'illegal',
              'hall_trade',
              'fraud',
              'sexual',
              'harassment',
              'hate',
            ].includes(report.reason);
            const target =
              report.targetLabel ||
              report.targetAlias ||
              localize(
                locale,
                '(removed content)',
                '(已移除内容)',
                '(已移除內容)',
              );
            return (
              <article key={report.id} className="moderation-card">
                <div>
                  <Badge variant={severe ? 'destructive' : 'secondary'}>
                    {reportReasonLabel(report.reason, locale)}
                  </Badge>
                  <span>
                    {report.reporterAlias ||
                      localize(
                        locale,
                        'Anonymous reporter',
                        '匿名举报',
                        '匿名舉報',
                      )}{' '}
                    · {formatAge(report.createdAt)}
                  </span>
                </div>
                <h4>{target}</h4>
                <p>
                  {targetTypeLabel(report.targetType, locale)}
                  {report.details ? ` — ${report.details}` : ''}
                </p>
                <div>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={actingId === report.id}
                    onClick={() => void act(report, 'remove')}
                  >
                    <Ban />{' '}
                    {localize(
                      locale,
                      'Remove & warn',
                      '移除并警告',
                      '移除並警告',
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actingId === report.id}
                    onClick={() => void act(report, 'dismiss')}
                  >
                    {localize(locale, 'Dismiss', '忽略', '忽略')}
                  </Button>
                </div>
              </article>
            );
          })
        ) : (
          <div className="queue-empty">
            <CheckCircle2 />
            <strong>
              {localize(locale, 'Queue cleared', '队列已清空', '隊列已清空')}
            </strong>
            <span>
              {localize(
                locale,
                'New reports will appear here.',
                '新的举报会显示在这里。',
                '新的舉報會顯示在這裡。',
              )}
            </span>
          </div>
        )}
      </div>
      {isOwner && (
        <>
          <div className="admin-section-title">
            <h3>
              <MessageSquarePlus />{' '}
              {localize(locale, 'Feedback', '反馈', '反饋')}
            </h3>
            <Badge>
              {feedbackItems.filter((item) => item.status === 'open').length}{' '}
              {localize(locale, 'OPEN', '待处理', '待處理')}
            </Badge>
          </div>
          <div className="feedback-toolbar">
            {(['all', 'open', 'resolved'] as const).map((value) => (
              <button
                key={value}
                className={feedbackFilter === value ? 'active' : ''}
                onClick={() => setFeedbackFilter(value)}
              >
                {value === 'all'
                  ? localize(locale, 'All', '全部', '全部')
                  : value === 'open'
                    ? localize(locale, 'Open', '待处理', '待處理')
                    : localize(locale, 'Resolved', '已处理', '已處理')}
              </button>
            ))}
          </div>
          {feedbackError && <div className="queue-error">{feedbackError}</div>}
          <div className="feedback-list">
            {feedbackLoading ? (
              <div className="queue-empty">
                <strong>
                  {localize(locale, 'Loading…', '加载中…', '載入中…')}
                </strong>
              </div>
            ) : (
              feedbackItems
                .filter(
                  (item) =>
                    feedbackFilter === 'all' ||
                    item.status === feedbackFilter,
                )
                .map((item) => (
                  <article
                    key={item.id}
                    className={`feedback-card ${item.status === 'resolved' ? 'resolved' : ''}`}
                  >
                    <div className="fc-head">
                      <Badge
                        variant={
                          item.status === 'open' ? 'secondary' : 'outline'
                        }
                      >
                        {feedbackCategoryLabel(item.category, locale)}
                      </Badge>
                      <strong>{item.username}</strong>
                      <span>
                        {item.alias} · {formatAge(item.createdAt)}
                      </span>
                    </div>
                    <p className="fc-body">{item.body}</p>
                    <div className="fc-foot">
                      <small>
                        {feedbackStatusLabel(item.status, locale)}
                        {item.status === 'resolved' && item.resolvedAt
                          ? ` · ${formatAge(item.resolvedAt)}`
                          : ''}
                      </small>
                      <Button
                        size="sm"
                        variant={item.status === 'open' ? 'outline' : 'ghost'}
                        disabled={feedbackActingId === item.id}
                        onClick={() => void toggleFeedback(item)}
                      >
                        {item.status === 'open'
                          ? localize(
                              locale,
                              'Mark resolved',
                              '标记为已处理',
                              '標記為已處理',
                            )
                          : localize(
                              locale,
                              'Reopen',
                              '重新打开',
                              '重新開啟',
                            )}
                      </Button>
                    </div>
                  </article>
                ))
            )}
            {!feedbackLoading && feedbackItems.length === 0 && (
              <div className="queue-empty">
                <CheckCircle2 />
                <strong>
                  {localize(
                    locale,
                    'No feedback yet.',
                    '还没有反馈。',
                    '還沒有反饋。',
                  )}
                </strong>
                <span>
                  {localize(
                    locale,
                    'New member feedback will appear here.',
                    '成员的新反馈会显示在这里。',
                    '成員嘅新反饋會顯示喺度。',
                  )}
                </span>
              </div>
            )}
          </div>
        </>
      )}
      <div className="team-card">
        <UserPlus />
        <div>
          <strong>
            {localize(locale, 'Moderation team', '管理员团队', '管理員團隊')}
          </strong>
          <p>
            {inviteSent
              ? localize(
                  locale,
                  'Invitation created · awaiting first ITSO sign-in',
                  '邀请已建立 · 等待对方首次 ITSO 登录',
                  '邀請已建立 · 等待對方首次 ITSO 登入',
                )
              : 'Owner 1 · Moderator 0'}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setInviteSent(true)}>
          {inviteSent
            ? localize(locale, 'Invited', '已邀请', '已邀請')
            : localize(locale, 'Invite moderator', '邀请管理员', '邀請管理員')}
        </Button>
      </div>
    </div>
  );
}

function ProfilePanel({
  locale,
  profile,
  onSaved,
}: {
  locale: Locale;
  profile: ProfileMember | null;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    nickname: '',
    department: '',
    programme: '',
    contactMethod: '',
    contactValue: '',
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      nickname: profile.nickname ?? '',
      department: profile.department ?? '',
      programme: profile.programme ?? '',
      contactMethod: profile.contactMethod ?? '',
      contactValue: profile.contactValue ?? '',
    });
    setError('');
  }, [profile]);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nickname: form.nickname,
          department: form.department,
          programme: form.programme,
          contactMethod: form.contactMethod,
          contactValue: form.contactValue,
          profileVisibility: 'private',
          preferredLanguage: locale,
        }),
      });
      if (!response.ok) throw new Error('save failed');
      setEditing(false);
      onSaved();
    } catch {
      setError(
        localize(
          locale,
          'Could not save. Please try again.',
          '保存失败，请稍后再试。',
          '儲存失敗，請稍後再試。',
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <SheetHeader className="profile-header">
        <SheetTitle>
          {localize(
            locale,
            'Loading profile…',
            '正在读取个人资料…',
            '正在讀取個人資料…',
          )}
        </SheetTitle>
      </SheetHeader>
    );
  }

  const initial =
    profile.anonymousAlias.trim().charAt(0).toUpperCase() || '?';
  const affiliationLabel =
    profile.affiliation === 'staff'
      ? localize(locale, 'Staff', '教职员', '教職員')
      : profile.affiliation === 'faculty'
        ? localize(locale, 'Faculty', '教员', '教員')
        : localize(locale, 'Student', '学生', '學生');
  const savedContact = contactLine(form.contactMethod, form.contactValue);

  return (
    <>
      <SheetHeader className="profile-header">
        <div className="profile-avatar">{initial}</div>
        <SheetTitle>{profile.anonymousAlias}</SheetTitle>
        <SheetDescription>
          <ShieldCheck />{' '}
          {localize(
            locale,
            'HKUST identity verified',
            'HKUST 身份已验证',
            'HKUST 身份已驗證',
          )}{' '}
          · {roleLabel(profile.role)}
        </SheetDescription>
      </SheetHeader>
      <div className="profile-body">
        <div className="privacy-banner">
          <ShieldCheck />
          <div>
            <strong>
              {localize(
                locale,
                'Anonymous by default',
                '默认匿名已开启',
                '預設匿名已開啟',
              )}
            </strong>
            <p>
              {localize(
                locale,
                'Only you can see the private details below; other members only see your anonymous alias.',
                '下面的真实资料仅你自己可见；其他成员只能看到你的匿名昵称。',
                '下面的真實資料僅你自己可見；其他成員只能看到你的匿名暱稱。',
              )}
            </p>
          </div>
        </div>
        {editing ? (
          <div className="profile-form">
            <div className="form-field">
              <label htmlFor="profile-nickname">
                {localize(locale, 'Nickname', '昵称', '暱稱')}
              </label>
              <Input
                id="profile-nickname"
                value={form.nickname}
                onChange={(event) =>
                  setForm({ ...form, nickname: event.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor="profile-department">
                {localize(locale, 'Department', '院系', '院系')}
              </label>
              <Input
                id="profile-department"
                value={form.department}
                onChange={(event) =>
                  setForm({ ...form, department: event.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor="profile-programme">
                {localize(locale, 'Programme / year', '课程／年级', '課程／年級')}
              </label>
              <Input
                id="profile-programme"
                value={form.programme}
                onChange={(event) =>
                  setForm({ ...form, programme: event.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor="profile-contact-method">
                {localize(locale, 'Contact method', '联系方式平台', '聯絡方式平台')}
              </label>
              <Input
                id="profile-contact-method"
                placeholder={localize(
                  locale,
                  'Telegram · WhatsApp · 邮箱',
                  'Telegram · WhatsApp · 邮箱',
                  'Telegram · WhatsApp · 郵箱',
                )}
                value={form.contactMethod}
                onChange={(event) =>
                  setForm({ ...form, contactMethod: event.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor="profile-contact">
                {localize(
                  locale,
                  'Contact handle / number',
                  '账号或号码',
                  '帳號或號碼',
                )}
              </label>
              <Input
                id="profile-contact"
                value={form.contactValue}
                onChange={(event) =>
                  setForm({ ...form, contactValue: event.target.value })
                }
              />
              <small className="field-hint">
                {localize(
                  locale,
                  'Only revealed to the other side after a mutual exchange.',
                  '只有在双方同意交换后才会向对方展示。',
                  '只有在雙方同意交換後才會向對方展示。',
                )}
              </small>
            </div>
            {error && <span className="consent-error">{error}</span>}
            <div className="profile-form-actions">
              <Button onClick={() => void save()} disabled={saving}>
                {saving
                  ? localize(locale, 'Saving…', '保存中…', '儲存中…')
                  : localize(locale, 'Save profile', '保存个人资料', '儲存個人資料')}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                {localize(locale, 'Cancel', '取消', '取消')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <dl>
              <div>
                <dt>
                  {localize(
                    locale,
                    'Public anonymous alias',
                    '公开匿名昵称',
                    '公開匿名暱稱',
                  )}
                </dt>
                <dd>{profile.anonymousAlias}</dd>
              </div>
              <div>
                <dt>
                  {localize(locale, 'Nickname', '昵称', '暱稱')}
                </dt>
                <dd>{form.nickname || '—'}</dd>
              </div>
              <div>
                <dt>{localize(locale, 'Real name', '真实姓名', '真實姓名')}</dt>
                <dd>{profile.fullName}</dd>
              </div>
              <div>
                <dt>{localize(locale, 'ITSO email', 'ITSO 邮箱', 'ITSO 電郵')}</dt>
                <dd>{profile.email}</dd>
              </div>
              <div>
                <dt>{localize(locale, 'Affiliation', '身份', '身份')}</dt>
                <dd>
                  {affiliationLabel} · {roleLabel(profile.role)}
                </dd>
              </div>
              <div>
                <dt>
                  {localize(
                    locale,
                    'Department / programme',
                    '院系／课程',
                    '院系／課程',
                  )}
                </dt>
                <dd>
                  {[form.department, form.programme].filter(Boolean).join(' · ') ||
                    '—'}
                </dd>
              </div>
              <div>
                <dt>
                  {localize(
                    locale,
                    'Contact (after mutual consent)',
                    '联系方式（双向同意后）',
                    '聯絡方式（雙向同意後）',
                  )}
                </dt>
                <dd>{savedContact || '—'}</dd>
              </div>
            </dl>
            <Button variant="outline" onClick={() => setEditing(true)}>
              {localize(locale, 'Edit profile', '编辑个人资料', '編輯個人資料')}
            </Button>
          </>
        )}
        <a href="/rules">
          {localize(
            locale,
            'Community rules and privacy',
            '社区规则与隐私说明',
            '社群規則與私隱說明',
          )}
        </a>
        <Button
          variant="destructive"
          className="profile-signout"
          onClick={() => {
            window.location.href = '/__gateway/logout';
          }}
        >
          <LogOut />
          {localize(locale, 'Sign out', '退出登录', '登出')}
        </Button>
      </div>
    </>
  );
}
