'use client';
/* oxlint-disable next/no-html-link-for-pages */

import { useEffect, useMemo, useState } from 'react';
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
  Map,
  MapPin,
  Megaphone,
  MessageCircle,
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

const initialRequests: RequestItem[] = [
  {
    id: 1,
    author: 'Blue Whale 271',
    category: 'hall',
    from: 'Hall VII',
    to: 'Hall III',
    title: 'Hall VII single room → Hall III',
    detail:
      'Looking for a Fall-term swap with the same eligible room type. Timing is flexible.',
    age: '3 min',
    replies: 4,
    hall: 'VII',
    locationId: 'ug-hall-vii',
    demo: true,
  },
  {
    id: 2,
    author: 'Red Squirrel 084',
    category: 'goods',
    from: 'Hall I',
    to: '',
    title: 'Monitor arm in excellent condition',
    detail:
      'Meet near North Gate or the halls. Open to swapping for desk organisers.',
    age: '8 min',
    replies: 2,
    hall: 'I',
    locationId: 'ug-hall-i',
    demo: true,
  },
  {
    id: 3,
    author: 'Sea Otter 619',
    category: 'study',
    from: 'Hall III',
    to: '',
    title: 'COMP 2011 study partner',
    detail:
      'Twice a week for practice questions and explaining concepts to each other.',
    age: '12 min',
    replies: 6,
    hall: 'III',
    locationId: 'ug-hall-iii',
    demo: true,
  },
  {
    id: 4,
    author: 'Night Heron 402',
    category: 'hall',
    from: 'Hall V',
    to: 'Hall VII',
    title: 'Hall V double room → Hall VII',
    detail:
      'Seeking an eligible partner for the official SHRLO process. No payment involved.',
    age: '18 min',
    replies: 1,
    hall: 'V',
    locationId: 'ug-hall-v',
    demo: true,
  },
  {
    id: 5,
    author: 'Starfish 933',
    category: 'other',
    from: 'Academic Building',
    to: '',
    title: 'Python beginner study partner',
    detail:
      'Weekend practice from the basics, paced around current coursework.',
    age: '24 min',
    replies: 3,
    hall: '',
    locationId: 'academic-building',
    demo: true,
  },
  {
    id: 6,
    author: 'Silver Fox 118',
    category: 'hall',
    from: 'GGT',
    to: 'UA Tower A',
    title: 'GGT single room → UA Tower A',
    detail:
      'RPG with a valid hall offer, looking to apply during the official swapping period.',
    age: '31 min',
    replies: 5,
    hall: 'GGT',
    locationId: 'ggt',
    demo: true,
  },
  {
    id: 7,
    author: 'Misty Whale 017',
    category: 'hall',
    from: 'Hall III',
    to: 'Hall VII',
    title: 'Hall III → Hall VII',
    detail: 'For the official swapping period and the same eligible room type.',
    age: '36 min',
    replies: 2,
    hall: 'III',
    locationId: 'ug-hall-iii',
    demo: true,
    mine: true,
  },
  {
    id: 8,
    author: 'Clouded Leopard 741',
    category: 'goods',
    from: 'Lee Shau Kee Business Building',
    to: '',
    title: 'Financial calculator exchange',
    detail:
      'Available to meet in a public area of the Business Building on weekday afternoons.',
    age: '41 min',
    replies: 1,
    hall: '',
    locationId: 'lsk-business-building',
    demo: true,
  },
  {
    id: 9,
    author: 'Night Heron 552',
    category: 'goods',
    from: 'Staff Quarters Towers 5–7',
    to: '',
    title: 'Looking to borrow a small trolley',
    detail:
      'For moving two storage boxes tonight. Will return it immediately afterwards.',
    age: '49 min',
    replies: 0,
    hall: '',
    locationId: 'sq-5-7',
    demo: true,
  },
  {
    id: 10,
    author: 'Starfish 033',
    category: 'other',
    from: 'North Bus Station',
    to: '',
    title: 'Heading towards Hang Hau around 20:30',
    detail:
      'Leaving from North Gate. Looking for company only; no money collection.',
    age: '1 hr',
    replies: 3,
    hall: '',
    locationId: 'north-bus-station',
    demo: true,
  },
];

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
  const [items, setItems] = useState<RequestItem[]>(initialRequests);
  const [selected, setSelected] = useState<RequestItem | null>(null);
  const [chatPost, setChatPost] = useState<RequestItem | null>(null);
  const [chatIds, setChatIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [showBubbles, setShowBubbles] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [adminOpen, setAdminOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
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
  const chatItems = items.filter((item) => chatIds.has(String(item.id)));
  const savedItems = items.filter((item) => savedIds.has(String(item.id)));
  const sectionItems =
    activeSection === 'matches'
      ? matchItems
      : activeSection === 'chats'
        ? chatItems
        : activeSection === 'saved'
          ? savedItems
          : filtered;

  const openChat = (item: RequestItem) => {
    setChatIds((current) => new Set(current).add(String(item.id)));
    setChatPost(item);
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
      setItems((current) => [
        { ...item, id: result.id!, mine: true, persisted: true },
        ...current,
      ]);
      setCreateOpen(false);
      setNotice(
        localize(
          locale,
          'Your request is now live.',
          '需求已安全写入本地数据库并发布到广场。',
          '需求已安全寫入本地資料庫並發佈到廣場。',
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
    let active = true;
    void fetch('/api/posts')
      .then(async (response) => {
        if (!response.ok) return [];
        const result = (await response.json()) as {
          items?: Array<{
            id: string;
            category: string;
            title: string;
            body: string;
            locationId: string | null;
            currentHall: string | null;
            targetHall: string | null;
            replyCount: number;
            anonymousAlias: string;
            isMine: boolean;
          }>;
        };
        return result.items ?? [];
      })
      .then((saved) => {
        if (!active || !saved.length) return;
        const mapped: RequestItem[] = saved.map((item) => ({
          id: item.id,
          author: item.anonymousAlias,
          category:
            item.category === 'service'
              ? 'other'
              : (item.category as Exclude<Category, 'all'>),
          from: item.currentHall ?? '',
          to: item.targetHall ?? '',
          title: item.title,
          detail: item.body,
          age: 'saved',
          replies: item.replyCount,
          hall: (item.currentHall ?? '').replace('Hall ', ''),
          locationId:
            item.locationId ||
            campusLocations.find(
              (location) => location.shortLabel === item.currentHall,
            )?.id ||
            'academic-building',
          mine: item.isMine,
          persisted: true,
        }));
        setItems((current) => [
          ...mapped,
          ...current.filter(
            (item) => !mapped.some((savedItem) => savedItem.id === item.id),
          ),
        ]);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void fetch('/api/profile')
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as {
          profile?: { currentLocationId?: string | null };
        };
      })
      .then((result) => {
        const locationId = result?.profile?.currentLocationId;
        if (locationId && getCampusLocation(locationId))
          setCurrentLocationId(locationId);
      })
      .catch(() => undefined);
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
      const storedChats = JSON.parse(
        localStorage.getItem('node:chats') || '[]',
      ) as string[];
      const storedLocale = localStorage.getItem('node:locale') as Locale | null;
      const storedBubbleSetting = localStorage.getItem('node:show-bubbles');
      queueMicrotask(() => {
        setSavedIds(new Set(storedSaved));
        setChatIds(new Set(storedChats));
        if (storedLocale && ['en', 'zh-CN', 'zh-HK'].includes(storedLocale))
          setLocale(storedLocale);
        if (storedBubbleSetting === 'false') setShowBubbles(false);
      });
    } catch {
      localStorage.removeItem('node:saved');
      localStorage.removeItem('node:chats');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('node:saved', JSON.stringify([...savedIds]));
  }, [savedIds]);

  useEffect(() => {
    localStorage.setItem('node:chats', JSON.stringify([...chatIds]));
  }, [chatIds]);

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
            />
          </Dialog>
          <button
            className="avatar-button"
            aria-label="Account"
            onClick={() => setProfileOpen(true)}
          >
            <span>W</span>
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
              count={chatItems.length || undefined}
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
          <button className="admin-link" onClick={() => setAdminOpen(true)}>
            <ShieldCheck /> {t.moderation}
            <Badge>ADMIN</Badge>
          </button>
          <div className="identity-card">
            <div className="mini-avatar">W</div>
            <div>
              <strong>Misty Whale 017</strong>
              <span>
                <ShieldCheck /> {t.profile}
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
              {sectionItems.length ? (
                sectionItems.map((item) => (
                  <RequestRow
                    key={item.id}
                    item={item}
                    locale={locale}
                    onClick={() =>
                      activeSection === 'chats'
                        ? openChat(item)
                        : setSelected(item)
                    }
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
                      : activeSection === 'chats'
                        ? localize(
                            locale,
                            'No anonymous chats yet',
                            '还没有匿名会话',
                            '還沒有匿名會話',
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
                      : activeSection === 'chats'
                        ? localize(
                            locale,
                            'Start a conversation from any request and it will appear here.',
                            '打开任意需求并开始沟通后，会显示在这里。',
                            '打開任意需求並開始溝通後，會顯示在這裡。',
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
          count={chatItems.length || undefined}
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
              onChat={() => {
                openChat(selected);
                setSelected(null);
              }}
              saved={savedIds.has(String(selected.id))}
              onSave={() => toggleSaved(selected)}
              onReport={() => {
                setNotice(
                  localize(
                    locale,
                    'Report submitted to the moderation queue.',
                    '举报已提交到管理员队列。',
                    '舉報已提交到管理員隊列。',
                  ),
                );
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
        open={Boolean(chatPost)}
        onOpenChange={(open) => !open && setChatPost(null)}
      >
        <SheetContent className="chat-sheet">
          {chatPost && <ChatPanel item={chatPost} locale={locale} />}
        </SheetContent>
      </Sheet>
      <Sheet open={adminOpen} onOpenChange={setAdminOpen}>
        <SheetContent className="admin-sheet">
          <AdminPanel
            locale={locale}
            onAnnouncementPublished={(announcement) =>
              setAnnouncements((current) => [announcement, ...current])
            }
          />
        </SheetContent>
      </Sheet>
      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent className="profile-sheet">
          <ProfilePanel locale={locale} />
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

function CreatePostDialog({
  t,
  locale,
  onCreated,
  currentLocationId,
}: {
  t: (typeof copy)[Locale];
  locale: Locale;
  onCreated: (item: RequestItem) => void;
  currentLocationId: string;
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
            author: 'Misty Whale 017',
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

function ChatPanel({ item, locale }: { item: RequestItem; locale: Locale }) {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 1,
      mine: false,
      body: localize(
        locale,
        `Hi, I’m ${item.author}. We can discuss the details here first.`,
        `你好，我是 ${item.author}。可以先聊一下具体条件。`,
        `你好，我是 ${item.author}。可以先談談具體條件。`,
      ),
      time: '15:24',
    },
  ]);
  const [contactRequested, setContactRequested] = useState(false);
  const send = () => {
    if (!draft.trim()) return;
    setMessages((current) => [
      ...current,
      {
        id: Date.now(),
        mine: true,
        body: draft.trim(),
        time: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    ]);
    setDraft('');
  };
  return (
    <>
      <SheetHeader className="chat-header">
        <div className="chat-peer">
          <div className="mini-avatar">{item.author.slice(0, 1)}</div>
          <div>
            <SheetTitle>{item.author}</SheetTitle>
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
          <strong>{item.title}</strong>
        </span>
      </div>
      <div className="message-stream">
        <div className="system-message">
          <ShieldCheck />{' '}
          {localize(
            locale,
            'NODE keeps real identities hidden until both people consent.',
            '双方同意前，平台不会显示任何真实资料',
            '雙方同意前，平台不會顯示任何真實資料',
          )}
        </div>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message-bubble ${message.mine ? 'mine' : ''}`}
          >
            <p>{message.body}</p>
            <span>{message.time}</span>
          </div>
        ))}
      </div>
      <div className="contact-consent">
        {contactRequested ? (
          <>
            <CheckCircle2 />
            <span>
              <strong>
                {localize(locale, 'Request sent', '请求已发送', '請求已發送')}
              </strong>
              <small>
                {localize(
                  locale,
                  'Contact details appear only after the other person agrees.',
                  '对方同意后，双方才会看到联系方式。',
                  '對方同意後，雙方才會看到聯絡方式。',
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
                  'Both people must confirm separately.',
                  '必须双方分别确认。',
                  '必須雙方分別確認。',
                )}
              </small>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setContactRequested(true)}
            >
              {localize(locale, 'Request exchange', '发起交换', '發起交換')}
            </Button>
          </>
        )}
      </div>
      <div className="chat-composer">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
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
          onClick={send}
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
  onAnnouncementPublished,
}: {
  locale: Locale;
  onAnnouncementPublished: (announcement: Announcement) => void;
}) {
  const [queue, setQueue] = useState([
    {
      id: 1,
      reason: 'Suspected bedspace trading',
      target: 'Hall place, price negotiable',
      reporter: '3 reports',
      risk: 'High risk',
    },
    {
      id: 2,
      reason: 'Public contact details',
      target: 'Phone number included in a public post',
      reporter: 'Automatic check',
      risk: 'Privacy',
    },
    {
      id: 3,
      reason: 'Repeated promotion',
      target: 'The same advert was posted six times',
      reporter: '1 report',
      risk: 'Spam',
    },
  ]);
  const [inviteSent, setInviteSent] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementKind, setAnnouncementKind] =
    useState<Announcement['kind']>('info');
  const [announcementStatus, setAnnouncementStatus] = useState('');
  const resolve = (id: number) =>
    setQueue((items) => items.filter((item) => item.id !== id));
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
    <>
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
      <div className="moderation-queue">
        {queue.length ? (
          queue.map((report) => (
            <article key={report.id} className="moderation-card">
              <div>
                <Badge variant={report.id === 1 ? 'destructive' : 'secondary'}>
                  {report.risk}
                </Badge>
                <span>{report.reporter}</span>
              </div>
              <h4>{report.reason}</h4>
              <p>“{report.target}”</p>
              <div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => resolve(report.id)}
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
                  onClick={() => resolve(report.id)}
                >
                  {localize(locale, 'Dismiss', '忽略', '忽略')}
                </Button>
              </div>
            </article>
          ))
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
    </>
  );
}

function ProfilePanel({ locale }: { locale: Locale }) {
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({
    nickname: 'Winston',
    department: 'Computer Science',
    programme: 'BEng · Year 2',
    contact: '@node_demo',
  });
  const save = () => {
    setEditing(false);
    void fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        nickname: profile.nickname,
        department: profile.department,
        programme: profile.programme,
        yearOfStudy: 'Year 2',
        contactMethod: 'Telegram',
        contactValue: profile.contact,
        profileVisibility: 'private',
        preferredLanguage: locale,
      }),
    });
  };
  return (
    <>
      <SheetHeader className="profile-header">
        <div className="profile-avatar">W</div>
        <SheetTitle>Local Demo Owner</SheetTitle>
        <SheetDescription>
          <ShieldCheck />{' '}
          {localize(
            locale,
            'HKUST identity verified · Owner',
            'HKUST 身份已验证 · Owner',
            'HKUST 身份已驗證 · Owner',
          )}
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
                'Only you and authorised moderators can view the private details below.',
                '以下真实资料只有你和获授权的管理员能够查看。',
                '以下真實資料只有你和獲授權的管理員能夠查看。',
              )}
            </p>
          </div>
        </div>
        {editing ? (
          <div className="profile-form">
            <div className="form-field">
              <label htmlFor="profile-nickname">
                {localize(locale, 'Personal nickname', '个人昵称', '個人暱稱')}
              </label>
              <Input
                id="profile-nickname"
                value={profile.nickname}
                onChange={(event) =>
                  setProfile({ ...profile, nickname: event.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor="profile-department">
                {localize(locale, 'Department', '院系', '院系')}
              </label>
              <Input
                id="profile-department"
                value={profile.department}
                onChange={(event) =>
                  setProfile({ ...profile, department: event.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor="profile-programme">
                {localize(
                  locale,
                  'Programme / year',
                  '课程／年级',
                  '課程／年級',
                )}
              </label>
              <Input
                id="profile-programme"
                value={profile.programme}
                onChange={(event) =>
                  setProfile({ ...profile, programme: event.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor="profile-contact">
                {localize(
                  locale,
                  'Contact shown after mutual consent',
                  '双方同意后显示的联系方式',
                  '雙方同意後顯示的聯絡方式',
                )}
              </label>
              <Input
                id="profile-contact"
                value={profile.contact}
                onChange={(event) =>
                  setProfile({ ...profile, contact: event.target.value })
                }
              />
            </div>
            <Button onClick={save}>
              {localize(locale, 'Save profile', '保存个人资料', '儲存個人資料')}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              {localize(locale, 'Cancel', '取消', '取消')}
            </Button>
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
                <dd>Misty Whale 017</dd>
              </div>
              <div>
                <dt>
                  {localize(
                    locale,
                    'Personal nickname',
                    '个人昵称',
                    '個人暱稱',
                  )}
                </dt>
                <dd>
                  {profile.nickname}{' '}
                  <span>{localize(locale, 'Hidden', '隐藏', '隱藏')}</span>
                </dd>
              </div>
              <div>
                <dt>{localize(locale, 'Real name', '真实姓名', '真實姓名')}</dt>
                <dd>
                  Local Demo Owner{' '}
                  <span>{localize(locale, 'Hidden', '隐藏', '隱藏')}</span>
                </dd>
              </div>
              <div>
                <dt>
                  {localize(locale, 'ITSO email', 'ITSO 邮箱', 'ITSO 電郵')}
                </dt>
                <dd>
                  demo@connect.ust.hk{' '}
                  <span>{localize(locale, 'Hidden', '隐藏', '隱藏')}</span>
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
                  {profile.department} · {profile.programme}{' '}
                  <span>{localize(locale, 'Hidden', '隐藏', '隱藏')}</span>
                </dd>
              </div>
              <div>
                <dt>{localize(locale, 'Contact', '联系方式', '聯絡方式')}</dt>
                <dd>
                  Telegram {profile.contact}{' '}
                  <span>
                    {localize(
                      locale,
                      'After mutual consent',
                      '双向同意后',
                      '雙向同意後',
                    )}
                  </span>
                </dd>
              </div>
              <div>
                <dt>{localize(locale, 'Identity', '身份', '身份')}</dt>
                <dd>
                  Student · Owner{' '}
                  <span>{localize(locale, 'Hidden', '隐藏', '隱藏')}</span>
                </dd>
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
      </div>
    </>
  );
}
