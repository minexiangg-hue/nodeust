'use client';
/* oxlint-disable next/no-html-link-for-pages */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Home, Settings, ArrowLeft, ArrowUpRight } from 'lucide-react';
import { HomePage } from '@/components/community/home-page';
import { SettingsPage } from '@/components/community/settings-page';
import { CommunityScreenContext } from '@/components/community/route-slot';
import {
  ActivityCard,
  RequestRow,
  ConversationRow,
  RequestDetail,
  FilterButton,
  MatchesPanel,
} from '@/components/community/request-cards';
import { AnnouncementBoard } from '@/components/community/announcement-board';
import { FeedbackDialog } from '@/components/community/feedback-dialog';
import { PostEditor } from '@/components/community/post-editor';
import { ChatPanel } from '@/components/community/chat-panel';
import { ProfilePage } from '@/components/community/profile-page';
import {
  copy,
  categoryMeta,
  mapPost,
  canModerateRole,
  type Category,
  type RequestItem,
  type ProfileMember,
  type ConversationItem,
  type ChatSession,
  type Announcement,
  type PostPayload,
  type MatchesResponse,
} from '@/lib/community-model';
import {
  sectionFromPath,
  sectionPaths,
  type CommunitySection,
} from '@/lib/community-navigation';
import Image from 'next/image';
import { ManagementConsole } from '@/components/management-console';
import { MyPosts, type MyPost } from '@/components/my-posts';
import { parseDrafts, type PostDraft } from '@/lib/drafts';
import { localize, type Locale } from '@/lib/locale';
import {
  ArrowLeftRight,
  Bell,
  Bookmark,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Trash2,
  List,
  Map,
  MapPin,
  MessageCircle,
  MessageSquarePlus,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
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
  DialogHeader,
  DialogTitle,
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
import {
  campusLocations,
  getCampusLocation,
  getCampusLocationLabel,
  getLocationGroupDescription,
  getLocationGroupLabel,
  locationGroups,
  type LocationGroupId,
} from '@/lib/campus-locations';

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  count,
}: {
  href: string;
  icon: typeof Map;
  label: string;
  active: boolean;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className={`rail-link ${active ? 'active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon />
      <span>{label}</span>
      {Boolean(count) && <b>{count}</b>}
    </Link>
  );
}
export function PlazaApp({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSection = sectionFromPath(pathname);
  const setActiveSection = useCallback(
    (section: keyof typeof sectionPaths) => router.push(sectionPaths[section]),
    [router],
  );
  const sourceDraft = searchParams.get('draft');
  const routeKey = pathname + (sourceDraft ? `?draft=${sourceDraft}` : '');
  const editorCache = useRef<Record<string, RequestItem>>({});
  const [loadedRoute, setLoadedRoute] = useState('');
  const [routeError, setRouteError] = useState('');
  const [defaultView, setDefaultView] = useState<'plaza' | 'list'>('plaza');
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [locale, setLocale] = useState<Locale>('en');
  const [category, setCategory] = useState<Category>('all');
  const [group, setGroup] = useState<LocationGroupId>('ug-housing');
  const [view, setView] = useState<'plaza' | 'list'>('plaza');
  const [query, setQuery] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  );
  const [currentLocationId, setCurrentLocationId] =
    useState('academic-building');
  const [locationSaving, setLocationSaving] = useState(false);
  const [items, setItems] = useState<RequestItem[]>([]);
  const [locationCounts, setLocationCounts] = useState<
    Record<string, { requestCount: number; peopleCount: number }>
  >({});
  const [selected, setSelectedItem] = useState<RequestItem | null>(null);
  const [profile, setProfile] = useState<ProfileMember | null>(null);
  const [matchOptions, setMatchOptions] = useState({
    kind: 'all' as Category,
    includePossible: false,
    page: 0,
  });
  const [matchRevision, setMatchRevision] = useState(0);
  const matchLoadVersion = useRef(0);
  const [matchView, setMatchView] = useState<{
    key: string;
    data: MatchesResponse | null;
    loading: boolean;
    error: boolean;
  }>({ key: '', data: null, loading: true, error: false });
  const [matchSummary, setMatchSummary] = useState<{
    memberId: string;
    highConfidenceCount: number;
    possibleCount: number;
    disabled: boolean;
  } | null>(null);
  const matchQueryKey = `${profile?.id ?? ''}:${matchOptions.kind}:${matchOptions.includePossible}:${matchOptions.page}:${matchRevision}`;
  const matchData = matchView.key === matchQueryKey ? matchView.data : null;
  const matchLoading = matchView.key !== matchQueryKey || matchView.loading;
  const matchError = matchView.key === matchQueryKey && matchView.error;
  const matchingDisabled =
    matchSummary?.memberId === profile?.id && Boolean(matchSummary?.disabled);
  const matchCount =
    matchSummary?.memberId === profile?.id && !matchingDisabled
      ? matchSummary?.highConfidenceCount
      : undefined;
  const conversationLoad = useRef(0);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [showBubbles, setShowBubbles] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const setSelected = (item: RequestItem | null) => {
    setSelectedItem(item);
    if (item) router.push(`/requests/${encodeURIComponent(item.id)}`);
  };
  const setCreateOpen = (open: boolean) => {
    if (!open) router.push('/posts');
  };
  const [myPostsVersion, setMyPostsVersion] = useState(0);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [noticeState, setNoticeState] = useState({ text: '' });
  const notice = noticeState.text;
  const setNotice = (text: string) => setNoticeState({ text });
  const [drafts, setDrafts] = useState<PostDraft[]>([]);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [editorItem, setEditorItem] = useState<RequestItem | undefined>();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [announcementReads, setAnnouncementReads] = useState<
    Record<string, string>
  >({});
  const draftKey = profile ? `node:drafts:${profile.id}` : null;
  const announcementKey = profile
    ? `node:announcement-reads:${profile.id}`
    : null;
  const announcementVersion = (item: Announcement) =>
    JSON.stringify([item.publishedAt, item.title, item.body, item.kind]);
  const hasUnreadAnnouncements = announcements.some(
    (item) => announcementReads[item.id] !== announcementVersion(item),
  );
  const unreadChats = conversations.reduce(
    (sum, item) => sum + (item.unreadCount || 0),
    0,
  );

  useEffect(() => {
    if (!noticeState.text) return;
    const timer = setTimeout(() => setNoticeState({ text: '' }), 4500);
    return () => clearTimeout(timer);
  }, [noticeState]);

  useEffect(() => {
    const hydrate = () => {
      try {
        setDrafts(draftKey ? parseDrafts(localStorage.getItem(draftKey)) : []);
      } catch {
        setDrafts([]);
      }
      try {
        const stored = announcementKey
          ? JSON.parse(localStorage.getItem(announcementKey) || '{}')
          : {};
        setAnnouncementReads(
          stored && typeof stored === 'object' && !Array.isArray(stored)
            ? stored
            : {},
        );
      } catch {
        setAnnouncementReads({});
      }
    };
    const timer = setTimeout(hydrate, 0);
    const changed = (event: StorageEvent) => {
      if (event.key === draftKey || event.key === announcementKey) hydrate();
    };
    window.addEventListener('storage', changed);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('storage', changed);
    };
  }, [draftKey, announcementKey]);

  const storeDrafts = (next: PostDraft[]) => {
    if (!draftKey)
      throw new Error(
        localize(
          locale,
          'Wait for your account to load.',
          '请等待账号加载完成。',
          '請等待帳號載入完成。',
        ),
      );
    localStorage.setItem(draftKey, JSON.stringify(next));
    setDrafts(next);
  };
  const openCreate = useCallback(
    (
      item?: RequestItem,
      sourceDraftId: string | null = null,
      postId: string | null = null,
    ) => {
      setEditorItem(item);
      setDraftId(sourceDraftId);
      setEditingId(postId);
      const target = postId
        ? `/posts/${encodeURIComponent(postId)}/edit`
        : `/posts/new${sourceDraftId ? `?draft=${encodeURIComponent(sourceDraftId)}` : ''}`;
      if (item) editorCache.current[target] = item;
      router.push(target);
    },
    [router],
  );
  const editPost = (post: MyPost) =>
    openCreate(
      {
        id: post.id,
        author: profile?.anonymousAlias ?? '',
        category: post.category,
        title: post.title,
        detail: post.body,
        from: post.currentHall ?? '',
        to: post.targetHall ?? '',
        locationId: post.locationId ?? currentLocationId,
        hall: '',
        age: '',
        replies: 0,
        mine: true,
      },
      null,
      post.id,
    );
  const saveDraft = (item: RequestItem) => {
    const entry: PostDraft = {
      id: draftId ?? crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
      title: item.title,
      detail: item.detail,
      category: item.category,
      from: item.from,
      to: item.to,
      locationId: item.locationId,
    };
    // Read at mutation time so another tab's saved drafts are preserved.
    storeDrafts([
      entry,
      ...parseDrafts(localStorage.getItem(draftKey!)).filter(
        (draft) => draft.id !== entry.id,
      ),
    ]);
    delete editorCache.current[routeKey];
    setCreateOpen(false);
    setNotice(
      localize(
        locale,
        'Draft saved to My posts.',
        '草稿已保存到“我的帖子”的草稿箱。',
        '草稿已儲存到「我的帖子」的草稿箱。',
      ),
    );
  };
  const markAnnouncementsRead = (visible: Announcement[]) => {
    const next = { ...announcementReads };
    for (const item of visible) next[item.id] = announcementVersion(item);
    setAnnouncementReads(next);
    if (announcementKey) {
      try {
        localStorage.setItem(announcementKey, JSON.stringify(next));
      } catch {
        /* Session reads still work. */
      }
    }
  };
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
  const savedItems = items.filter((item) => savedIds.has(String(item.id)));
  const sectionItems =
    activeSection === 'saved'
      ? savedItems
      : filtered.filter(
          (item) => getCampusLocation(item.locationId)?.group === group,
        );

  const loadLocationCounts = async () => {
    try {
      const response = await fetch('/api/location', { cache: 'no-store' });
      if (!response.ok) return;
      const result = (await response.json()) as {
        items: {
          locationId: string;
          requestCount: number;
          peopleCount: number;
        }[];
      };
      setLocationCounts(
        Object.fromEntries(result.items.map((item) => [item.locationId, item])),
      );
    } catch {
      /* Keep the last successful count. */
    }
  };
  const peopleLabel = (id: string, compact = false) => {
    const count = locationCounts[id]?.peopleCount;
    return count === undefined
      ? localize(locale, 'People: —', '人数：—', '人數：—')
      : localize(
          locale,
          `${count} ${count === 1 ? 'person' : 'people'}${compact ? '' : ' tagged here'}`,
          compact ? `${count} 人` : `${count} 人选择此地点`,
          compact ? `${count} 人` : `${count} 人選擇此地點`,
        );
  };

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
    const version = ++conversationLoad.current;
    try {
      const response = await fetch('/api/conversations');
      if (!response.ok) return;
      const result = (await response.json()) as { items?: ConversationItem[] };
      if (version === conversationLoad.current)
        setConversations(result.items ?? []);
    } catch {
      /* Ignore transient failures; the next poll retries. */
    }
  };

  const loadAnnouncements = async () => {
    try {
      const response = await fetch('/api/announcements', { cache: 'no-store' });
      if (!response.ok) return;
      const result = (await response.json()) as { items?: Announcement[] };
      setAnnouncements(result.items ?? []);
    } catch {
      /* Keep the current board until the next refresh. */
    }
  };

  const openSession = (session: ChatSession) => {
    setChatSession(session);
    router.push(`/messages/${encodeURIComponent(session.conversationId)}`);
    void loadConversations();
  };

  // From a post detail: open a thread with its author (creating or reusing the
  // conversation). For the poster's own request, jump to their inbox instead.
  const ensureThread = async (item: RequestItem) => {
    if (item.mine) {
      setSelected(null);
      setActiveSection('chats');
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
    setLocationSaving(true);
    try {
      const response = await fetch('/api/location', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ locationId }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error);
      setCurrentLocationId(locationId);
      void loadLocationCounts();
      setNotice(
        localize(
          locale,
          `Location updated to ${getCampusLocationLabel(getCampusLocation(locationId), locale)}.`,
          `地点标签已更新为 ${getCampusLocationLabel(getCampusLocation(locationId), locale)}。`,
          `地點標籤已更新為 ${getCampusLocationLabel(getCampusLocation(locationId), locale)}。`,
        ),
      );
      return true;
    } catch {
      setNotice(
        localize(
          locale,
          'Could not update the location. Please try again.',
          '地点更新失败，请重试。',
          '地點更新失敗，請重試。',
        ),
      );
      return false;
    } finally {
      setLocationSaving(false);
    }
  };

  const publishPost = async (item: RequestItem) => {
    if (
      item.locationId !== currentLocationId &&
      !(await updateLocation(item.locationId))
    )
      throw new Error(
        localize(
          locale,
          'Could not sync location. Try again.',
          '地点同步失败，请重试。',
          '地點同步失敗，請重試。',
        ),
      );
    const response = await fetch(
      editingId ? `/api/posts/${encodeURIComponent(editingId)}` : '/api/posts',
      {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: editingId ? 'edit' : undefined,
          category: item.category,
          title: item.title,
          body: item.detail,
          locationId: item.locationId,
          currentHall: item.from || null,
          targetHall: item.to || null,
        }),
      },
    );
    const result = (await response.json()) as { id?: string; error?: string };
    if (!response.ok || !result.id)
      throw new Error(
        result.error ||
          localize(
            locale,
            'Could not save. Try again.',
            '保存失败，请重试。',
            '儲存失敗，請重試。',
          ),
      );
    if (draftId && draftKey) {
      try {
        storeDrafts(
          parseDrafts(localStorage.getItem(draftKey)).filter(
            (item) => item.id !== draftId,
          ),
        );
      } catch {
        /* Publishing succeeded; retain the draft if storage is unavailable. */
      }
    }
    setMatchRevision((version) => version + 1);
    await Promise.all([loadPosts(), loadLocationCounts()]);
    delete editorCache.current[routeKey];
    setCreateOpen(false);
    setMyPostsVersion((version) => version + 1);
    setNotice(
      editingId
        ? localize(locale, 'Post updated.', '帖子已更新。', '帖子已更新。')
        : localize(
            locale,
            'Your request is now live.',
            '需求已发布到广场。',
            '需求已發佈到廣場。',
          ),
    );
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPosts();
      void loadLocationCounts();
      void loadConversations();
      void reloadProfile();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Matches have their own query, independent of the plaza's bounded feed and filters.
  // Only the match/home/update views poll; other routes refresh their sidebar count once.
  useEffect(() => {
    const memberId = profile?.id;
    if (!memberId) return;
    const isMatchPage = activeSection === 'matches';
    const polling =
      isMatchPage ||
      activeSection === 'home' ||
      activeSection === 'announcements';
    const version = ++matchLoadVersion.current;
    let stopped = false;
    let inFlight = false;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    const current = () => !stopped && version === matchLoadVersion.current;
    const load = async () => {
      if (!current() || inFlight || document.visibilityState !== 'visible')
        return;
      inFlight = true;
      controller = new AbortController();
      if (isMatchPage)
        setMatchView((previous) => ({
          key: matchQueryKey,
          data: previous.key === matchQueryKey ? previous.data : null,
          loading: true,
          error: false,
        }));
      const params = new URLSearchParams({
        page: String(isMatchPage ? matchOptions.page : 0),
      });
      if (isMatchPage && matchOptions.includePossible)
        params.set('possible', '1');
      if (isMatchPage && matchOptions.kind !== 'all')
        params.set('kind', matchOptions.kind);
      try {
        const response = await fetch(`/api/matches?${params}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('matches-unavailable');
        const result = (await response.json()) as MatchesResponse;
        if (!Array.isArray(result.items) || !Array.isArray(result.needsDetails))
          throw new Error('matches-unavailable');
        if (!current()) return;
        setMatchSummary({
          memberId,
          highConfidenceCount: result.highConfidenceCount,
          possibleCount: result.possibleCount,
          disabled: Boolean(result.disabled),
        });
        if (isMatchPage) {
          setMatchView({
            key: matchQueryKey,
            data: result,
            loading: false,
            error: false,
          });
          // A removed/closed result can make the last page disappear.
          if (!result.items.length && matchOptions.page > 0)
            setMatchOptions((previous) => ({
              ...previous,
              page: Math.max(0, Math.ceil(result.total / 25) - 1),
            }));
        }
      } catch {
        if (!current()) return;
        setMatchSummary(null);
        if (isMatchPage)
          setMatchView({
            key: matchQueryKey,
            data: null,
            loading: false,
            error: true,
          });
      } finally {
        inFlight = false;
        if (current() && polling && document.visibilityState === 'visible')
          timer = window.setTimeout(
            () => void load(),
            isMatchPage ? 30000 : 60000,
          );
      }
    };
    const onVisibility = () => {
      window.clearTimeout(timer);
      if (document.visibilityState === 'visible') void load();
    };
    timer = window.setTimeout(() => void load(), 0);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [profile?.id, activeSection, matchOptions, matchQueryKey, matchRevision]);

  // Lightweight polling so a second browser sees new posts / inbound chats
  // without a manual refresh.
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === 'hidden') return;
      void loadPosts();
      void loadLocationCounts();
      void loadConversations();
    };
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => void loadAnnouncements(), 0);
    const timer = setInterval(() => void loadAnnouncements(), 30000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem('node:saved') || '[]');
        if (Array.isArray(saved))
          setSavedIds(new Set(saved.filter((id) => typeof id === 'string')));
        const language = localStorage.getItem('node:locale') as Locale | null;
        if (language && ['en', 'zh-CN', 'zh-HK'].includes(language))
          setLocale(language);
        setShowBubbles(localStorage.getItem('node:show-bubbles') !== 'false');
        const preferred =
          localStorage.getItem('node:default-view') === 'list'
            ? 'list'
            : 'plaza';
        setDefaultView(preferred);
        setView(preferred);
        const remembered = JSON.parse(
          sessionStorage.getItem('node:explore-state') || 'null',
        );
        if (remembered) {
          if (['plaza', 'list'].includes(remembered.view))
            setView(remembered.view);
          if (locationGroups.some((g) => g.id === remembered.group))
            setGroup(remembered.group);
          if (
            ['all', 'hall', 'goods', 'study', 'transport', 'other'].includes(
              remembered.category,
            )
          )
            setCategory(remembered.category);
          if (typeof remembered.query === 'string') setQuery(remembered.query);
          if (
            typeof remembered.zoom === 'number' &&
            remembered.zoom >= 0.8 &&
            remembered.zoom <= 1.15
          )
            setZoom(remembered.zoom);
        }
      } catch {
        /* Browser storage may be disabled; the session remains usable. */
      }
      setPreferencesReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    if (!preferencesReady) return;
    try {
      localStorage.setItem('node:saved', JSON.stringify([...savedIds]));
      localStorage.setItem('node:locale', locale);
      localStorage.setItem('node:show-bubbles', String(showBubbles));
      localStorage.setItem('node:default-view', defaultView);
      sessionStorage.setItem(
        'node:explore-state',
        JSON.stringify({ view, group, category, query, zoom }),
      );
    } catch {
      /* Saved drafts still report storage errors at the point of saving. */
    }
  }, [
    preferencesReady,
    savedIds,
    locale,
    showBubbles,
    defaultView,
    view,
    group,
    category,
    query,
    zoom,
  ]);

  const changeLocale = async (next: Locale) => {
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ preferredLanguage: next }),
      });
      if (!response.ok) return false;
      setLocale(next);
      setProfile((current) =>
        current ? { ...current, preferredLanguage: next } : current,
      );
      return true;
    } catch {
      return false;
    }
  };

  const profileId = profile?.id;
  // Every ID route loads from an authorized endpoint, independently of feed windows.
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setRouteError('');
      setSelectedLocationId(null);
      try {
        if (activeSection === 'request' || activeSection === 'edit') {
          const id = pathname.split('/')[2];
          const response = await fetch(`/api/posts/${id}`, {
            signal: controller.signal,
          });
          if (!response.ok) throw new Error('unavailable');
          const result = (await response.json()) as {
            post: PostPayload & { status: string };
          };
          if (activeSection === 'edit') {
            if (
              !result.post.isMine ||
              !['active', 'closed'].includes(result.post.status)
            )
              throw new Error('unavailable');
            setEditingId(id);
            setDraftId(null);
            setEditorItem(
              editorCache.current[routeKey] ?? mapPost(result.post),
            );
          } else setSelectedItem(mapPost(result.post));
        } else if (activeSection === 'conversation') {
          const id = pathname.split('/')[2];
          const response = await fetch(`/api/conversations/${id}`, {
            signal: controller.signal,
          });
          if (!response.ok) throw new Error('unavailable');
          const result = (await response.json()) as { session: ChatSession };
          setChatSession(result.session);
        } else if (activeSection === 'create') {
          if (!profileId) return;
          setEditingId(null);
          setDraftId(sourceDraft);
          let initial = editorCache.current[routeKey];
          if (!initial && sourceDraft) {
            const draft = parseDrafts(
              localStorage.getItem(`node:drafts:${profileId}`),
            ).find((entry) => entry.id === sourceDraft);
            if (!draft) throw new Error('unavailable');
            initial = { ...draft, author: '', age: '', replies: 0, hall: '' };
          }
          setEditorItem(initial);
        }
        if (!controller.signal.aborted) setLoadedRoute(routeKey);
      } catch {
        if (!controller.signal.aborted) {
          setRouteError('unavailable');
          setLoadedRoute(routeKey);
        }
      }
    };
    const timer = setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [pathname, sourceDraft, profileId, activeSection, routeKey]);

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
            enum: ['all', 'hall', 'goods', 'study', 'transport', 'other'],
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
            !['all', 'hall', 'goods', 'study', 'transport', 'other'].includes(
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
        openCreate();
        return { status: 'form_opened' };
      },
    });
    return () => lifecycle.abort();
  }, [openCreate, setActiveSection]);

  const aliasInitial =
    profile?.anonymousAlias?.trim().charAt(0).toUpperCase() ?? '?';
  const canModerate = profile ? canModerateRole(profile.role) : false;

  const titles: Record<CommunitySection, [string, string, string]> = {
    home: ['Home', '首页', '首頁'],
    explore: ['Explore campus', '探索广场', '探索廣場'],
    matches: ['My matches', '我的匹配', '我的配對'],
    chats: ['Messages', '匿名私聊', '匿名私聊'],
    conversation: ['Conversation', '匿名会话', '匿名會話'],
    saved: ['Saved requests', '已收藏', '已收藏'],
    posts: ['My posts', '我的帖子', '我的帖子'],
    create: ['Post a request', '发布需求', '發佈需求'],
    edit: ['Edit request', '编辑帖子', '編輯帖子'],
    profile: ['My profile', '个人资料', '個人資料'],
    settings: ['Settings', '设置', '設定'],
    announcements: ['Community updates', '社群动态', '社群動態'],
    moderation: ['Moderation', '管理中心', '管理中心'],
    request: ['Request details', '需求详情', '需求詳情'],
  };
  const pageTitle = localize(locale, ...titles[activeSection]);
  const pageEyebrow = localize(
    locale,
    'YOUR CAMPUS, CONNECTED',
    '连接你的校园生活',
    '連接你的校園生活',
  );
  const pageDescription =
    activeSection === 'explore'
      ? localize(
          locale,
          'Find a place. Discover what someone needs.',
          '从一个地点开始，发现彼此的需求。',
          '從一個地點開始，發現彼此的需求。',
        )
      : activeSection === 'matches'
        ? localize(
            locale,
            'Two needs. One shared solution.',
            '让彼此的需求，成为对方的答案。',
            '讓彼此的需求，成為對方的答案。',
          )
        : activeSection === 'chats'
          ? localize(
              locale,
              'A private space to make things happen.',
              '在私密的对话中，让想法成为可能。',
              '在私密的對話中，讓想法成為可能。',
            )
          : activeSection === 'posts'
            ? localize(
                locale,
                'Everything you have shared, all in one place.',
                '管理你发布的需求，以及还未完成的想法。',
                '管理你發佈的需求，以及還未完成的想法。',
              )
            : localize(
                locale,
                'Your own corner of the community.',
                '这里是你在社群中的专属空间。',
                '這裡是你在社群中的專屬空間。',
              );
  const primaryLinks = [
    {
      section: 'home' as const,
      icon: Home,
      label: localize(locale, 'Home', '首页', '首頁'),
    },
    { section: 'explore' as const, icon: Map, label: t.explore },
    {
      section: 'matches' as const,
      icon: Sparkles,
      label: t.matches,
      count: matchCount,
    },
    {
      section: 'chats' as const,
      icon: MessageCircle,
      label: localize(locale, 'Messages', '匿名私聊', '匿名私聊'),
      count: unreadChats,
    },
    {
      section: 'posts' as const,
      icon: List,
      label: localize(locale, 'My posts', '我的帖子', '我的帖子'),
    },
    {
      section: 'saved' as const,
      icon: Bookmark,
      label: t.saved,
      count: savedItems.length,
    },
  ];
  const sectionIsActive = (section: string) =>
    activeSection === section ||
    (section === 'chats' && activeSection === 'conversation') ||
    (section === 'posts' && ['create', 'edit'].includes(activeSection));
  const needsResource = ['request', 'conversation', 'edit', 'create'].includes(
    activeSection,
  );
  const pageHeading = (
    <header className="page-heading">
      <p className="eyebrow">{pageEyebrow}</p>
      <h1>{pageTitle}</h1>
    </header>
  );
  const resourceFallback = (
    <output className="section-empty">
      <ShieldCheck />
      <strong>
        {routeError
          ? localize(
              locale,
              'This item is unavailable',
              '内容暂不可用',
              '內容暫不可用',
            )
          : localize(locale, 'Loading…', '加载中…', '載入中…')}
      </strong>
      <p>
        {routeError &&
          localize(
            locale,
            'It may have been removed, or your account may not have access.',
            '内容可能已移除，或你的账号没有访问权限。',
            '內容可能已移除，或你的帳號沒有存取權限。',
          )}
      </p>
      {routeError && (
        <Link
          className="text-link"
          href={activeSection === 'conversation' ? '/messages' : '/posts'}
        >
          {localize(locale, 'Go back', '返回', '返回')} <ArrowUpRight />
        </Link>
      )}
    </output>
  );
  const sectionContent =
    needsResource && (loadedRoute !== routeKey || routeError) ? (
      <>
        {pageHeading}
        {resourceFallback}
      </>
    ) : activeSection === 'home' ? (
      <HomePage
        locale={locale}
        alias={profile?.anonymousAlias}
        unreadAnnouncements={hasUnreadAnnouncements}
        matchCount={matchCount}
        matchingDisabled={matchingDisabled}
      />
    ) : activeSection === 'matches' ? (
      <>
        {pageHeading}
        <MatchesPanel
          locale={locale}
          data={matchData}
          loading={matchLoading}
          error={matchError}
          kind={matchOptions.kind}
          includePossible={matchOptions.includePossible}
          page={matchOptions.page}
          onKindChange={(kind) =>
            setMatchOptions((previous) => ({ ...previous, kind, page: 0 }))
          }
          onPossibleChange={(includePossible) =>
            setMatchOptions((previous) => ({
              ...previous,
              includePossible,
              page: 0,
            }))
          }
          onPageChange={(page) =>
            setMatchOptions((previous) => ({ ...previous, page }))
          }
          onReload={() => setMatchRevision((version) => version + 1)}
          onOpen={setSelected}
          onChat={ensureThread}
        />
      </>
    ) : activeSection === 'settings' ? (
      <>
        <SettingsPage
          locale={locale}
          onLocaleChange={changeLocale}
          showBubbles={showBubbles}
          onShowBubblesChange={(next) => {
            localStorage.setItem('node:show-bubbles', String(next));
            setShowBubbles(next);
          }}
          defaultView={defaultView}
          onDefaultViewChange={(next) => {
            localStorage.setItem('node:default-view', next);
            setDefaultView(next);
            setView(next);
          }}
          currentLocationId={currentLocationId}
          onLocationChange={updateLocation}
          locationSaving={locationSaving}
          onFeedback={() => setFeedbackOpen(true)}
        />
      </>
    ) : activeSection === 'profile' ? (
      <>
        {pageHeading}
        <div className="profile-page">
          <ProfilePage
            locale={locale}
            profile={profile}
            onSaved={() => void reloadProfile()}
            onSetLocale={(next) => {
              void changeLocale(next).then((ok) => {
                if (!ok)
                  setNotice(
                    localize(
                      locale,
                      'Could not save language.',
                      '语言保存失败。',
                      '語言儲存失敗。',
                    ),
                  );
              });
            }}
            onOpenFeedback={() => setFeedbackOpen(true)}
          />
        </div>
      </>
    ) : activeSection === 'moderation' ? (
      <>
        {canModerate && (
          <ManagementConsole
            page
            locale={locale}
            isOwner={profile?.role === 'owner'}
            onAnnouncementsChanged={() => void loadAnnouncements()}
            onPostsChanged={() => {
              setSelectedItem(null);
              setMyPostsVersion((v) => v + 1);
              setMatchRevision((version) => version + 1);
              void loadPosts();
              void loadLocationCounts();
            }}
          />
        )}
      </>
    ) : activeSection === 'create' || activeSection === 'edit' ? (
      <>
        {pageHeading}
        <div className="editor-layout">
          <PostEditor
            key={routeKey}
            t={t}
            locale={locale}
            onCreated={publishPost}
            currentLocationId={currentLocationId}
            authorAlias={profile?.anonymousAlias ?? ''}
            initial={editorItem}
            editing={Boolean(editingId)}
            onSaveDraft={saveDraft}
            onLocationChange={updateLocation}
            locationSaving={locationSaving}
            onChange={(item) => {
              editorCache.current[routeKey] = item;
            }}
          />
          <aside className="editor-note">
            <ShieldCheck />
            <h2>
              {localize(
                locale,
                'A good connection starts here',
                '好的连接，从这里开始',
                '好的連接，從這裡開始',
              )}
            </h2>
            <p>
              {localize(
                locale,
                'A clear title and a little context help the right person find you. Keep personal details private until you both agree to exchange them.',
                '写一个清晰的标题，补充必要背景，让合适的人找到你。双方同意交换前，请保留私人联系方式。',
                '寫一個清晰的標題，補充必要背景，讓合適的人找到你。雙方同意交換前，請保留私人聯絡方式。',
              )}
            </p>
            <Link href="/rules">
              {localize(locale, 'Community rules', '社群规则', '社群規則')}{' '}
              <ArrowUpRight />
            </Link>
            <Link href="/posts">
              {localize(
                locale,
                'My posts & drafts',
                '我的帖子与草稿',
                '我的帖子與草稿',
              )}{' '}
              <ArrowUpRight />
            </Link>
          </aside>
        </div>
      </>
    ) : activeSection === 'conversation' ? (
      <>
        <Link href="/messages" className="inline-back">
          <ArrowLeft />
          {localize(locale, 'All conversations', '全部会话', '全部會話')}
        </Link>
        <div className="conversation-page">
          {chatSession && (
            <ChatPanel
              key={chatSession.conversationId}
              session={chatSession}
              myAlias={profile?.anonymousAlias ?? ''}
              onConversationChanged={() => void loadConversations()}
              locale={locale}
            />
          )}
        </div>
      </>
    ) : activeSection === 'request' ? (
      <>
        {pageHeading}
        <article className="request-detail-page">
          {selected && (
            <RequestDetail
              page
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
              }}
            />
          )}
        </article>
      </>
    ) : activeSection === 'announcements' ? (
      <>
        {pageHeading}{' '}
        <div className="announce-scroll">
          {activeSection === 'announcements' && (
            <AnnouncementBoard
              announcements={announcements}
              locale={locale}
              onRead={markAnnouncementsRead}
              open={activeSection === 'announcements'}
            />
          )}
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
                onClick={() => {
                  setSelected(item);
                }}
              />
            ))}
          </div>
          <div className="match-card">
            <div className="match-orbit">
              <ArrowLeftRight />
            </div>
            <Badge>
              {localize(locale, 'MY MATCHES', '我的匹配', '我的配對')}
            </Badge>
            <h3>
              {matchingDisabled
                ? localize(
                    locale,
                    'Matching is temporarily paused',
                    '匹配暂时暂停',
                    '配對暫時暫停',
                  )
                : matchCount
                  ? localize(
                      locale,
                      `${matchCount} complementary requests`,
                      `${matchCount} 条互补需求`,
                      `${matchCount} 則互補需求`,
                    )
                  : localize(
                      locale,
                      'Find complementary requests',
                      '寻找互补需求',
                      '尋找互補需求',
                    )}
            </h3>
            <p>
              {matchingDisabled
                ? localize(
                    locale,
                    'Please check back later. Your posts remain available.',
                    '请稍后再查看匹配，你的帖子仍可使用。',
                    '請稍後再查看配對，你的帖子仍可使用。',
                  )
                : localize(
                    locale,
                    'Housing, items, study, transport and activities: see which requests fit yours.',
                    '宿舍、物品、学习、交通和活动，看看哪些需求与你互补。',
                    '宿舍、物品、學習、交通和活動，看看哪些需求與你互補。',
                  )}
            </p>
            <Button
              onClick={() => {
                window.setTimeout(() => {
                  setActiveSection('matches');
                }, 120);
              }}
            >
              {localize(locale, 'View matches', '查看匹配', '查看配對')}
            </Button>
          </div>
          <a href="/rules" className="policy-note">
            <ShieldCheck /> {t.notice}
          </a>
        </div>
      </>
    ) : (
      <>
        {' '}
        <div className="workspace-toolbar">
          <div>
            <div className="eyebrow">
              <span className="pulse-dot" />
              {pageEyebrow}
            </div>
            <h1>{pageTitle}</h1>
            <p className="workspace-description">{pageDescription}</p>
          </div>
          <div className="toolbar-controls">
            {activeSection === 'explore' && (
              <label className="mobile-search search-box">
                <Search />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t.search}
                  aria-label={t.search}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label={localize(
                      locale,
                      'Clear search',
                      '清除搜索',
                      '清除搜尋',
                    )}
                  >
                    <X />
                  </button>
                )}
              </label>
            )}
            {activeSection === 'explore' && (
              <div className="explore-categories" aria-label={t.filters}>
                <FilterButton
                  label={t.all}
                  icon={SlidersHorizontal}
                  active={category === 'all'}
                  onClick={() => setCategory('all')}
                />
                {(Object.keys(categoryMeta) as Exclude<Category, 'all'>[]).map(
                  (key) => (
                    <FilterButton
                      key={key}
                      label={t[key]}
                      icon={categoryMeta[key].icon}
                      color={categoryMeta[key].color}
                      active={category === key}
                      onClick={() => setCategory(key)}
                    />
                  ),
                )}
              </div>
            )}
            {activeSection === 'explore' && (
              <div className="category-picker">
                <Select
                  value={category}
                  onValueChange={(value) => {
                    if (value) setCategory(value as Category);
                  }}
                >
                  <SelectTrigger
                    aria-label={localize(
                      locale,
                      'Request category',
                      '需求分类',
                      '需求分類',
                    )}
                  >
                    <SelectValue>{t[category]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      [
                        'all',
                        'hall',
                        'goods',
                        'study',
                        'transport',
                        'other',
                      ] as const
                    ).map((value) => (
                      <SelectItem key={value} value={value}>
                        {t[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                  disabled={locationSaving}
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
                    <SelectValue>
                      {getCampusLocationLabel(currentLocation, locale)}
                    </SelectValue>
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
            ) : null}
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
                <strong>{getLocationGroupLabel(locationGroup, locale)}</strong>
                <span>{locationGroup.labelEn}</span>
              </button>
            ))}
          </div>
        )}
        {activeSection === 'posts' ? (
          <MyPosts
            key={myPostsVersion}
            locale={locale}
            onChanged={() => {
              setMatchRevision((version) => version + 1);
              void loadPosts();
              void loadLocationCounts();
            }}
            onCreate={() => openCreate()}
            onEdit={editPost}
            onDrafts={() => {
              try {
                setDrafts(parseDrafts(localStorage.getItem(draftKey!)));
              } catch {
                /* Retain loaded drafts. */
              }
              setDraftsOpen(true);
            }}
            draftCount={drafts.length}
          />
        ) : view === 'plaza' && activeSection === 'explore' ? (
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
                const count = locationCounts[location.id]?.requestCount;
                const countLabel =
                  count === undefined
                    ? localize(locale, 'Requests: —', '需求：—', '需求：—')
                    : localize(
                        locale,
                        `${count} ${count === 1 ? 'request' : 'requests'}`,
                        `${count} 条需求`,
                        `${count} 條需求`,
                      );
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
                    aria-label={`${location.label}，${countLabel}，${peopleLabel(location.id)}`}
                  >
                    <span className="node-orbit" />
                    <strong>{getCampusLocationLabel(location, locale)}</strong>
                    <span className="location-requests">{countLabel}</span>
                    <small
                      className="location-people"
                      title={peopleLabel(location.id)}
                    >
                      {peopleLabel(location.id, true)}
                    </small>
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
                        <span className="bubble-connector" aria-hidden="true" />
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
                  {activeSection === 'saved'
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
                  {activeSection === 'saved'
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
      </>
    );

  return (
    <div className="community-app min-h-screen bg-background text-foreground">
      <a href="#main-content" className="skip-link">
        {localize(locale, 'Skip to content', '跳到内容', '跳到內容')}
      </a>
      <header className="app-header">
        <Link className="brand" href="/" aria-label="NODE home">
          <Image
            className="brand-icon"
            src="/node-brand-icon.png"
            alt=""
            width={34}
            height={34}
            priority
          />
          <span>
            NODE<span className="brand-community">CAMPUS COMMUNITY</span>
          </span>
        </Link>
        <form
          className="search-box"
          onSubmit={(event) => {
            event.preventDefault();
            router.push('/explore');
          }}
        >
          <Search aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.search}
            aria-label={t.search}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={localize(
                locale,
                'Clear search',
                '清除搜索',
                '清除搜尋',
              )}
            >
              <X />
            </button>
          )}
          <button
            type="submit"
            className="search-submit"
            aria-label={localize(
              locale,
              'Search requests',
              '搜索需求',
              '搜尋需求',
            )}
          >
            <ArrowUpRight />
          </button>
        </form>
        <div className="header-actions">
          <Link
            href="/announcements"
            className="header-icon icon-link"
            aria-label={localize(locale, 'Announcements', '公告', '公告')}
          >
            <Bell />
            {hasUnreadAnnouncements && <i className="header-dot" />}
          </Link>
          <Link
            href="/settings"
            className="header-icon icon-link header-settings"
            aria-label={localize(locale, 'Settings', '设置', '設定')}
          >
            <Settings />
          </Link>
          <Link href="/posts/new" className="post-button button-link">
            <Plus />
            {t.post}
          </Link>
          <Link
            href="/profile"
            className="avatar-button"
            aria-label={localize(locale, 'My profile', '个人资料', '個人資料')}
          >
            <span>{aliasInitial}</span>
          </Link>
        </div>
      </header>
      <div className="app-shell">
        <aside className="left-rail">
          <p className="nav-caption">
            {localize(locale, 'COMMUNITY', '社群', '社群')}
          </p>
          <nav
            aria-label={localize(
              locale,
              'Primary navigation',
              '主导航',
              '主導覽',
            )}
          >
            {primaryLinks.map((item) => (
              <NavItem
                key={item.section}
                href={sectionPaths[item.section]}
                icon={item.icon}
                label={item.label}
                count={item.count}
                active={sectionIsActive(item.section)}
              />
            ))}
          </nav>
          <div className="rail-secondary">
            <p className="nav-caption">
              {localize(locale, 'PERSONAL', '个人', '個人')}
            </p>
            <NavItem
              href="/profile"
              icon={UserRound}
              label={localize(locale, 'My profile', '个人资料', '個人資料')}
              active={activeSection === 'profile'}
            />
            <NavItem
              href="/settings"
              icon={Settings}
              label={localize(locale, 'Settings', '设置', '設定')}
              active={activeSection === 'settings'}
            />
            {canModerate && (
              <NavItem
                href="/moderation"
                icon={ShieldCheck}
                label={t.moderation}
                active={activeSection === 'moderation'}
              />
            )}
          </div>
          <div className="rail-bottom">
            <Link href="/rules">
              <ShieldCheck />
              {localize(locale, 'Community rules', '社群规则', '社群規則')}
            </Link>
            <button onClick={() => setFeedbackOpen(true)}>
              <MessageSquarePlus />
              {localize(locale, 'Send feedback', '意见反馈', '意見反饋')}
            </button>
            <Link href="/profile" className="rail-identity">
              <span className="mini-avatar">{aliasInitial}</span>
              <span>
                <strong>{profile?.anonymousAlias ?? '…'}</strong>
                <small>
                  {localize(
                    locale,
                    'Anonymous by default',
                    '默认匿名',
                    '預設匿名',
                  )}
                </small>
              </span>
              <ArrowUpRight />
            </Link>
            <span className="rail-version">NODE / HKUST · BETA</span>
          </div>
        </aside>
        <main
          id="main-content"
          tabIndex={-1}
          className={`workspace page-${activeSection}`}
        >
          <CommunityScreenContext.Provider value={sectionContent}>
            {children}
          </CommunityScreenContext.Provider>
        </main>
      </div>
      <nav
        className="mobile-nav"
        aria-label={localize(
          locale,
          'Mobile navigation',
          '移动端导航',
          '行動版導覽',
        )}
      >
        <NavItem
          href="/"
          icon={Home}
          label={localize(locale, 'Home', '首页', '首頁')}
          active={activeSection === 'home'}
        />
        <NavItem
          href="/explore"
          icon={Map}
          label={localize(locale, 'Explore', '探索', '探索')}
          active={activeSection === 'explore'}
        />
        <Link className="mobile-create" href="/posts/new" aria-label={t.post}>
          <Plus />
        </Link>
        <NavItem
          href="/messages"
          icon={MessageCircle}
          label={localize(locale, 'Messages', '消息', '訊息')}
          active={sectionIsActive('chats')}
          count={unreadChats}
        />
        <NavItem
          href="/profile"
          icon={UserRound}
          label={localize(locale, 'Me', '我的', '我的')}
          active={[
            'profile',
            'settings',
            'posts',
            'saved',
            'matches',
            'moderation',
          ].includes(activeSection)}
        />
      </nav>
      <Dialog open={draftsOpen} onOpenChange={setDraftsOpen}>
        <DialogContent className="draft-dialog">
          <DialogHeader>
            <DialogTitle>
              {localize(locale, 'Draft box', '草稿箱', '草稿箱')}
            </DialogTitle>
            <DialogDescription>
              {localize(
                locale,
                'Drafts are saved for this account in this browser. Select one to continue writing.',
                '草稿保存在当前浏览器中，按账号分开。点击草稿继续编辑。',
                '草稿儲存在目前瀏覽器中，按帳號分開。點擊草稿繼續編輯。',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="draft-list">
            {!drafts.length && (
              <p>
                {localize(
                  locale,
                  'No saved drafts.',
                  '还没有保存的草稿。',
                  '還沒有儲存的草稿。',
                )}
              </p>
            )}
            {drafts.map((draft) => (
              <div className="draft-row" key={draft.id}>
                <button
                  onClick={() => {
                    setDraftsOpen(false);
                    openCreate(
                      { ...draft, author: '', age: '', replies: 0, hall: '' },
                      draft.id,
                    );
                  }}
                >
                  <strong>
                    {draft.title ||
                      localize(
                        locale,
                        'Untitled draft',
                        '未命名草稿',
                        '未命名草稿',
                      )}
                  </strong>
                  <small>
                    {new Date(draft.updatedAt).toLocaleString(locale)}
                  </small>
                  <p>{draft.detail.slice(0, 100)}</p>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={localize(
                    locale,
                    'Delete draft',
                    '删除草稿',
                    '刪除草稿',
                  )}
                  onClick={() => {
                    try {
                      storeDrafts(
                        parseDrafts(localStorage.getItem(draftKey!)).filter(
                          (item) => item.id !== draft.id,
                        ),
                      );
                    } catch {
                      setNotice(
                        localize(
                          locale,
                          'Could not delete draft.',
                          '草稿删除失败。',
                          '草稿刪除失敗。',
                        ),
                      );
                    }
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

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
              <p className="location-count-note">
                {peopleLabel(selectedLocation.id)} ·{' '}
                {localize(
                  locale,
                  'Manual tags, not live presence.',
                  '按个人手动标签统计，非实时在线人数。',
                  '按個人手動標籤統計，非即時在線人數。',
                )}
              </p>
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
                  const locationId = selectedLocation.id;
                  setSelectedLocationId(null);
                  openCreate({
                    id: '',
                    author: '',
                    category: 'hall',
                    from: '',
                    to: '',
                    title: '',
                    detail: '',
                    hall: '',
                    age: '',
                    replies: 0,
                    locationId,
                  });
                  void updateLocation(locationId);
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

      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <FeedbackDialog
          locale={locale}
          onClose={() => setFeedbackOpen(false)}
          onSent={(message) => {
            setFeedbackOpen(false);
            setNotice(message);
          }}
        />
      </Dialog>
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
    </div>
  );
}
