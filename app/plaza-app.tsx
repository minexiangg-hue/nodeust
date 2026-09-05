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
  Flag,
  Gavel,
  List,
  Map,
  MapPin,
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
  locationGroups,
  type LocationGroupId,
} from '@/lib/campus-locations';

type Locale = 'zh-CN' | 'zh-HK' | 'en';
type Category = 'all' | 'hall' | 'goods' | 'study' | 'other';
type ActiveSection = 'explore' | 'matches' | 'chats' | 'saved';
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
    author: '蓝鲸 271',
    category: 'hall',
    from: 'Hall VII',
    to: 'Hall III',
    title: 'Hall VII 单人房 → Hall III',
    detail: '希望交换 Fall term，同性别房型。时间灵活，可先匿名沟通具体情况。',
    age: '3 min',
    replies: 4,
    hall: 'VII',
    locationId: 'ug-hall-vii',
    demo: true,
  },
  {
    id: 2,
    author: '松鼠 084',
    category: 'goods',
    from: 'Hall I',
    to: '',
    title: '出九成新显示器支架',
    detail: '北门或宿舍区面交，也可以交换桌面收纳用品。',
    age: '8 min',
    replies: 2,
    hall: 'I',
    locationId: 'ug-hall-i',
    demo: true,
  },
  {
    id: 3,
    author: '水獭 619',
    category: 'study',
    from: 'Hall III',
    to: '',
    title: '找 COMP 2011 复习搭子',
    detail: '每周两次，主要刷题和互相讲概念。',
    age: '12 min',
    replies: 6,
    hall: 'III',
    locationId: 'ug-hall-iii',
    demo: true,
  },
  {
    id: 4,
    author: '夜鹭 402',
    category: 'hall',
    from: 'Hall V',
    to: 'Hall VII',
    title: 'Hall V 双人房 → Hall VII',
    detail: '寻找符合 SHRLO 条件的正式换宿伙伴，不涉及任何费用。',
    age: '18 min',
    replies: 1,
    hall: 'V',
    locationId: 'ug-hall-v',
    demo: true,
  },
  {
    id: 5,
    author: '海星 933',
    category: 'other',
    from: 'Academic Building',
    to: '',
    title: '找 Python 入门学习伙伴',
    detail: '周末一起从零练习，内容可以按课程作业进度调整。',
    age: '24 min',
    replies: 3,
    hall: '',
    locationId: 'academic-building',
    demo: true,
  },
  {
    id: 6,
    author: '银狐 118',
    category: 'hall',
    from: 'GGT',
    to: 'UA Tower A',
    title: 'GGT 单人房 → UA Tower A',
    detail: 'RPG，已有有效 hall offer，希望在正式 swapping period 申请。',
    age: '31 min',
    replies: 5,
    hall: 'GGT',
    locationId: 'ggt',
    demo: true,
  },
  {
    id: 7,
    author: '雾鲸 017',
    category: 'hall',
    from: 'Hall III',
    to: 'Hall VII',
    title: 'Hall III → Hall VII',
    detail: '希望在官方 swapping period 内办理，同性别房型。',
    age: '36 min',
    replies: 2,
    hall: 'III',
    locationId: 'ug-hall-iii',
    demo: true,
    mine: true,
  },
  {
    id: 8,
    author: '云豹 741',
    category: 'goods',
    from: 'Lee Shau Kee Business Building',
    to: '',
    title: '交换闲置财务计算器',
    detail: '工作日下午可在商学大楼公共区域交收。',
    age: '41 min',
    replies: 1,
    hall: '',
    locationId: 'lsk-business-building',
    demo: true,
  },
  {
    id: 9,
    author: '夜鹭 552',
    category: 'goods',
    from: 'Staff Quarters Towers 5–7',
    to: '',
    title: '借用搬运小推车',
    detail: '今晚搬两个收纳箱，用完即还。',
    age: '49 min',
    replies: 0,
    hall: '',
    locationId: 'sq-5-7',
    demo: true,
  },
  {
    id: 10,
    author: '海星 033',
    category: 'other',
    from: 'North Bus Station',
    to: '',
    title: '坑口方向拼车同行',
    detail: '20:30 左右从北门出发，只找同行者，不代收费用。',
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

export function PlazaApp() {
  const [locale, setLocale] = useState<Locale>('zh-CN');
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
        `地点标签已更新为 ${getCampusLocation(locationId)?.shortLabel}。`,
      );
    } catch {
      setNotice('地点已在本页更新，但暂时无法同步到本地数据库。');
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
        setNotice(result.error ?? '发布失败，请稍后再试。');
        return;
      }
      setItems((current) => [
        { ...item, id: result.id!, mine: true, persisted: true },
        ...current,
      ]);
      setCreateOpen(false);
      setNotice('需求已安全写入本地数据库并发布到广场。');
    } catch {
      setNotice('发布失败，请检查本地服务后重试。');
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
    try {
      const storedSaved = JSON.parse(
        localStorage.getItem('node:saved') || '[]',
      ) as string[];
      const storedChats = JSON.parse(
        localStorage.getItem('node:chats') || '[]',
      ) as string[];
      queueMicrotask(() => {
        setSavedIds(new Set(storedSaved));
        setChatIds(new Set(storedChats));
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
          <kbd>⌘ K</kbd>
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
              <strong>雾鲸 017</strong>
              <span>
                <ShieldCheck /> {t.profile}
              </span>
            </div>
            <MoreHorizontal />
            <p>{t.hidden}</p>
            <p className="identity-location">
              <MapPin /> {currentLocation?.shortLabel}
            </p>
          </div>
        </aside>

        <section className="workspace">
          <div className="workspace-toolbar">
            <div>
              <div className="eyebrow">
                <span className="pulse-dot" />
                {activeSection === 'explore'
                  ? `${t.live} · 当前记录动态计数`
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
                    <MapPin /> 我的位置标签
                  </span>
                  <Select
                    value={currentLocationId}
                    onValueChange={(value) => {
                      if (value) void updateLocation(value);
                    }}
                  >
                    <SelectTrigger aria-label="手动设置位置标签">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {campusLocations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.shortLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <small>
                    <Clock3 /> 手动更新 · 非 GPS
                  </small>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setActiveSection('explore')}
                >
                  <Map /> 返回地图
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
            <div className="campus-groups" aria-label="校园分区">
              {locationGroups.map((locationGroup) => (
                <button
                  key={locationGroup.id}
                  className={group === locationGroup.id ? 'active' : ''}
                  onClick={() => setGroup(locationGroup.id)}
                >
                  <strong>{locationGroup.label}</strong>
                  <span>{locationGroup.labelEn}</span>
                </button>
              ))}
            </div>
          )}

          {view === 'plaza' && activeSection === 'explore' ? (
            <div className="plaza-canvas" aria-label="校园需求地点广场">
              <div className="zone-context">
                <strong>
                  {locationGroups.find((entry) => entry.id === group)?.label}
                </strong>
                <span>
                  {
                    locationGroups.find((entry) => entry.id === group)
                      ?.description
                  }
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
                      ? `${realCount} 实际 · ${demoCount} DEMO`
                      : `${realCount} 条需求`
                    : demoCount
                      ? `${demoCount} DEMO`
                      : '暂无需求';
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
                      <strong>{location.shortLabel}</strong>
                      <span>{countLabel}</span>
                    </button>
                  );
                })}
                {filtered
                  .filter(
                    (item) =>
                      getCampusLocation(item.locationId)?.group === group,
                  )
                  .slice(0, 5)
                  .map((item, index) => {
                    const meta = categoryMeta[item.category];
                    const Icon = meta.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelected(item)}
                        className={`request-bubble bubble-${index}`}
                        style={
                          {
                            '--bubble-color': meta.color,
                          } as React.CSSProperties
                        }
                      >
                        <span className="request-icon">
                          <Icon />
                        </span>
                        <span>
                          <strong>{item.title}</strong>
                          <small>
                            {item.demo && 'DEMO · '}
                            {getCampusLocation(item.locationId)?.shortLabel}
                          </small>
                        </span>
                      </button>
                    );
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
                点击地点查看这里的全部需求 · 所有数字由当前记录动态计算
              </p>
            </div>
          ) : (
            <div className="request-list">
              {sectionItems.length ? (
                sectionItems.map((item) => (
                  <RequestRow
                    key={item.id}
                    item={item}
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
                      ? '暂时没有双向宿舍匹配'
                      : activeSection === 'chats'
                        ? '还没有匿名会话'
                        : activeSection === 'saved'
                          ? '还没有收藏'
                          : '这个分区暂时没有符合条件的需求'}
                  </strong>
                  <span>
                    {activeSection === 'matches'
                      ? '发布或调整需求后，系统会自动计算路线互补的对象。'
                      : activeSection === 'chats'
                        ? '打开任意需求并开始沟通后，会显示在这里。'
                        : activeSection === 'saved'
                          ? '打开需求详情，即可加入收藏。'
                          : '切换分区或清除筛选条件后再看看。'}
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
              查看全部 <ChevronDown />
            </button>
          </div>
          <div className="panel-title">
            <h2>正在发生</h2>
            <span>{filtered.length} 个相关需求</span>
          </div>
          <div className="activity-list">
            {filtered.slice(0, 4).map((item) => (
              <ActivityCard
                key={item.id}
                item={item}
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
              {matchItems.length ? '发现双向宿舍匹配' : '正在寻找路线互补需求'}
            </h3>
            <p>
              {matchItems.length
                ? `${matchItems[0].from} → ${matchItems[0].to} 已找到反向需求。`
                : '有新的互补路线时，会自动出现在“我的匹配”。'}
            </p>
            <Button
              onClick={() => {
                setActiveSection('matches');
                setView('list');
              }}
            >
              查看匹配
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
              onChat={() => {
                openChat(selected);
                setSelected(null);
              }}
              saved={savedIds.has(String(selected.id))}
              onSave={() => toggleSaved(selected)}
              onReport={() => {
                setNotice('举报已提交到管理员队列。');
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
                  {
                    locationGroups.find(
                      (entry) => entry.id === selectedLocation.group,
                    )?.label
                  }
                </div>
                <SheetTitle>{selectedLocation.label}</SheetTitle>
                <SheetDescription>
                  {selectedLocationItems.length
                    ? `这里共有 ${selectedLocationItems.length} 条当前记录；演示内容均标有 DEMO。`
                    : '这里暂时没有需求；你可以成为第一个发布者。'}
                </SheetDescription>
              </SheetHeader>
              <div className="location-request-list">
                {selectedLocationItems.length ? (
                  selectedLocationItems.map((item) => (
                    <RequestRow
                      key={item.id}
                      item={item}
                      onClick={() => {
                        setSelectedLocationId(null);
                        setSelected(item);
                      }}
                    />
                  ))
                ) : (
                  <div className="section-empty compact">
                    <MapPin />
                    <strong>暂无需求</strong>
                    <span>地点计数为 0；不会用占位数字填充。</span>
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
                <Plus /> 在这里发布需求
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
          {chatPost && <ChatPanel item={chatPost} />}
        </SheetContent>
      </Sheet>
      <Sheet open={adminOpen} onOpenChange={setAdminOpen}>
        <SheetContent className="admin-sheet">
          <AdminPanel />
        </SheetContent>
      </Sheet>
      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent className="profile-sheet">
          <ProfilePanel />
        </SheetContent>
      </Sheet>
      {notice && (
        <output className="app-notice" aria-live="polite">
          <CheckCircle2 />
          {notice}
          <button onClick={() => setNotice('')} aria-label="关闭">
            <X />
          </button>
        </output>
      )}
    </main>
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
  onClick,
}: {
  item: RequestItem;
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
          {getCampusLocation(item.locationId)?.shortLabel} · {item.age}
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
  onClick,
}: {
  item: RequestItem;
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
          {getCampusLocation(item.locationId)?.shortLabel} · {item.author} ·{' '}
          {item.age} · {item.replies} replies
        </small>
      </div>
      <ChevronDown />
    </button>
  );
}

function RequestDetail({
  item,
  t,
  onChat,
  saved,
  onSave,
  onReport,
}: {
  item: RequestItem;
  t: (typeof copy)[Locale];
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
          由 {item.author} 发布 · {item.age} 前
        </SheetDescription>
      </SheetHeader>
      <div className="detail-body">
        {item.category === 'hall' && (
          <div className="swap-route">
            <div>
              <small>当前</small>
              <strong>{item.from}</strong>
            </div>
            <ArrowLeftRight />
            <div>
              <small>目标</small>
              <strong>{item.to}</strong>
            </div>
          </div>
        )}
        <div className="request-location-card">
          <MapPin />
          <div>
            <small>发布地点</small>
            <strong>
              {getCampusLocation(item.locationId)?.label ?? '未设置地点'}
            </strong>
          </div>
          {item.demo && <Badge variant="secondary">DEMO</Badge>}
        </div>
        <p>{item.detail}</p>
        <div className="safety-box">
          <ShieldCheck />
          <div>
            <strong>隐私保护已开启</strong>
            <p>双方同意前，真实姓名、邮箱及联系方式都不会展示。</p>
          </div>
        </div>
        <div className="detail-actions">
          <Button size="lg" onClick={onChat}>
            <MessageCircle /> {t.chat}
          </Button>
          <Button variant="outline" size="lg" onClick={onSave}>
            <Bookmark fill={saved ? 'currentColor' : 'none'} />
            {saved ? '已收藏' : '收藏'}
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
  onCreated,
  currentLocationId,
}: {
  t: (typeof copy)[Locale];
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
          只填写匹配所需信息；房号、学号和联系方式请勿公开。
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
            author: '雾鲸 017',
            category: postCategory,
            from,
            to,
            hall: from.replace('Hall ', '') || 'I',
            title: typeof titleValue === 'string' ? titleValue : '新的匿名需求',
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
            <label htmlFor="post-category">需求类型</label>
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
            <label htmlFor="post-location">发布地点</label>
            <Select name="locationId" defaultValue={currentLocationId}>
              <SelectTrigger id="post-location">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {campusLocations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.shortLabel} ·{' '}
                    {
                      locationGroups.find(
                        (entry) => entry.id === location.group,
                      )?.label
                    }
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <small className="field-hint">手动地点标签，不读取 GPS。</small>
          </div>
          {postCategory === 'hall' && (
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="post-from">当前宿舍</label>
                <Input
                  id="post-from"
                  name="from"
                  required
                  placeholder="Hall VII"
                />
              </div>
              <div className="form-field">
                <label htmlFor="post-to">目标宿舍</label>
                <Input id="post-to" name="to" required placeholder="Hall III" />
              </div>
            </div>
          )}
          <div className="form-field">
            <label htmlFor="post-title">标题</label>
            <Input
              id="post-title"
              name="title"
              required
              maxLength={100}
              placeholder="一句话说明你的需求"
            />
          </div>
          <div className="form-field">
            <label htmlFor="post-detail">补充说明</label>
            <Textarea
              id="post-detail"
              name="detail"
              required
              maxLength={2000}
              placeholder="房型、时间与其他必要条件…"
            />
          </div>
          <div className="rules-reminder">
            <ShieldCheck />
            <p>
              <strong>发布即表示同意社区规则</strong>
              <br />
              禁止违法违规、床位交易、诈骗、骚扰、仇恨、色情、泄露隐私及未经许可的商业推广。
              <a href="/rules">查看完整规则</a>
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline">
            保存草稿
          </Button>
          <Button type="submit">
            <Plus /> 发布到广场
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function ChatPanel({ item }: { item: RequestItem }) {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 1,
      mine: false,
      body: `你好，我是 ${item.author}。可以先聊一下具体条件。`,
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
              <span className="pulse-dot" /> 匿名会话 · 在线
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>
      <div className="chat-context">
        <ArrowLeftRight />
        <span>
          <small>讨论中的需求</small>
          <strong>{item.title}</strong>
        </span>
      </div>
      <div className="message-stream">
        <div className="system-message">
          <ShieldCheck /> 双方同意前，平台不会显示任何真实资料
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
              <strong>请求已发送</strong>
              <small>对方同意后，双方才会看到联系方式。</small>
            </span>
          </>
        ) : (
          <>
            <UserPlus />
            <span>
              <strong>需要转到校外联系？</strong>
              <small>必须双方分别确认。</small>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setContactRequested(true)}
            >
              发起交换
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
          placeholder="输入匿名消息…"
        />
        <Button size="icon-lg" onClick={send} aria-label="发送">
          <Send />
        </Button>
      </div>
    </>
  );
}

function AdminPanel() {
  const [queue, setQueue] = useState([
    {
      id: 1,
      reason: '疑似宿位交易',
      target: 'Hall place，价钱可议',
      reporter: '3 人举报',
      risk: '高风险',
    },
    {
      id: 2,
      reason: '公开个人联系方式',
      target: '帖子正文包含电话号码',
      reporter: '自动检测',
      risk: '隐私',
    },
    {
      id: 3,
      reason: '重复推广',
      target: '补习广告重复发布 6 次',
      reporter: '1 人举报',
      risk: '垃圾信息',
    },
  ]);
  const [inviteSent, setInviteSent] = useState(false);
  const resolve = (id: number) =>
    setQueue((items) => items.filter((item) => item.id !== id));
  return (
    <>
      <SheetHeader className="admin-header">
        <div className="detail-category">
          <Gavel /> OWNER CONSOLE
        </div>
        <SheetTitle>管理中心</SheetTitle>
        <SheetDescription>
          你是首位 Owner，可邀请管理员并处理帖子和账号。
        </SheetDescription>
      </SheetHeader>
      <div className="admin-metrics">
        <div>
          <strong>{queue.length}</strong>
          <span>待处理举报</span>
        </div>
        <div>
          <strong>2</strong>
          <span>自动拦截</span>
        </div>
        <div>
          <strong>18m</strong>
          <span>平均处理时间</span>
        </div>
      </div>
      <div className="admin-section-title">
        <h3>审核队列</h3>
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
                  <Ban /> 移除并警告
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resolve(report.id)}
                >
                  忽略
                </Button>
              </div>
            </article>
          ))
        ) : (
          <div className="queue-empty">
            <CheckCircle2 />
            <strong>队列已清空</strong>
            <span>新的举报会显示在这里。</span>
          </div>
        )}
      </div>
      <div className="team-card">
        <UserPlus />
        <div>
          <strong>管理员团队</strong>
          <p>
            {inviteSent
              ? '邀请已建立 · 等待对方首次 ITSO 登录'
              : 'Owner 1 · Moderator 0'}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setInviteSent(true)}>
          {inviteSent ? '已邀请' : '邀请管理员'}
        </Button>
      </div>
    </>
  );
}

function ProfilePanel() {
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
        preferredLanguage: 'zh-CN',
      }),
    });
  };
  return (
    <>
      <SheetHeader className="profile-header">
        <div className="profile-avatar">W</div>
        <SheetTitle>Local Demo Owner</SheetTitle>
        <SheetDescription>
          <ShieldCheck /> HKUST 身份已验证 · Owner
        </SheetDescription>
      </SheetHeader>
      <div className="profile-body">
        <div className="privacy-banner">
          <ShieldCheck />
          <div>
            <strong>默认匿名已开启</strong>
            <p>以下真实资料只有你和获授权的管理员能够查看。</p>
          </div>
        </div>
        {editing ? (
          <div className="profile-form">
            <div className="form-field">
              <label htmlFor="profile-nickname">个人昵称</label>
              <Input
                id="profile-nickname"
                value={profile.nickname}
                onChange={(event) =>
                  setProfile({ ...profile, nickname: event.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor="profile-department">院系</label>
              <Input
                id="profile-department"
                value={profile.department}
                onChange={(event) =>
                  setProfile({ ...profile, department: event.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor="profile-programme">课程／年级</label>
              <Input
                id="profile-programme"
                value={profile.programme}
                onChange={(event) =>
                  setProfile({ ...profile, programme: event.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor="profile-contact">双方同意后显示的联系方式</label>
              <Input
                id="profile-contact"
                value={profile.contact}
                onChange={(event) =>
                  setProfile({ ...profile, contact: event.target.value })
                }
              />
            </div>
            <Button onClick={save}>保存个人资料</Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              取消
            </Button>
          </div>
        ) : (
          <>
            <dl>
              <div>
                <dt>公开匿名昵称</dt>
                <dd>雾鲸 017</dd>
              </div>
              <div>
                <dt>个人昵称</dt>
                <dd>
                  {profile.nickname} <span>隐藏</span>
                </dd>
              </div>
              <div>
                <dt>真实姓名</dt>
                <dd>
                  Local Demo Owner <span>隐藏</span>
                </dd>
              </div>
              <div>
                <dt>ITSO 邮箱</dt>
                <dd>
                  demo@connect.ust.hk <span>隐藏</span>
                </dd>
              </div>
              <div>
                <dt>院系／课程</dt>
                <dd>
                  {profile.department} · {profile.programme} <span>隐藏</span>
                </dd>
              </div>
              <div>
                <dt>联系方式</dt>
                <dd>
                  Telegram {profile.contact} <span>双向同意后</span>
                </dd>
              </div>
              <div>
                <dt>身份</dt>
                <dd>
                  Student · Owner <span>隐藏</span>
                </dd>
              </div>
            </dl>
            <Button variant="outline" onClick={() => setEditing(true)}>
              编辑个人资料
            </Button>
          </>
        )}
        <a href="/rules">社区规则与隐私说明</a>
      </div>
    </>
  );
}
