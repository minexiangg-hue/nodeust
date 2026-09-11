'use client';

import Link from 'next/link';
import { useState } from 'react';

import {
  ArrowLeftRight,
  Bookmark,
  ChevronDown,
  Flag,
  Map,
  MapPin,
  MessageCircle,
  ShieldCheck,
  CheckCircle2,
  CircleHelp,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  getCampusLocation,
  getCampusLocationLabel,
} from '@/lib/campus-locations';
import {
  categoryMeta,
  copy,
  formatClock,
  mapPost,
  type Category,
  type MatchPayload,
  type MatchesResponse,
  type RequestItem,
  type ConversationItem,
} from '@/lib/community-model';
import { localize, type Locale } from '@/lib/locale';
import { matchMissingLabels, matchReasonLabel } from '@/lib/match-copy';

export function ActivityCard({
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

export function FilterButton({
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

export function MatchesPanel({
  locale,
  data,
  loading,
  error,
  kind,
  includePossible,
  page,
  onKindChange,
  onPossibleChange,
  onPageChange,
  onReload,
  onOpen,
  onChat,
}: {
  locale: Locale;
  data: MatchesResponse | null;
  loading: boolean;
  error: boolean;
  kind: Category;
  includePossible: boolean;
  page: number;
  onKindChange: (kind: Category) => void;
  onPossibleChange: (include: boolean) => void;
  onPageChange: (page: number) => void;
  onReload: () => void;
  onOpen: (item: RequestItem) => void;
  onChat: (item: RequestItem) => Promise<void>;
}) {
  const t = (en: string, cn: string, hk: string) =>
    localize(locale, en, cn, hk);
  const labels = copy[locale];
  if (data?.disabled)
    return (
      <section className="matches-panel">
        <output className="section-empty match-empty">
          <CircleHelp aria-hidden="true" />
          <strong>
            {t(
              'Matching is temporarily paused',
              '匹配暂时暂停',
              '配對暫時暫停',
            )}
          </strong>
          <p>
            {t(
              'Your requests and conversations remain available. Please check back later.',
              '你的帖子和对话仍可使用，请稍后再查看匹配。',
              '你的帖子和對話仍可使用，請稍後再查看配對。',
            )}
          </p>
          <div className="match-empty-actions">
            <Link href="/posts" className="match-text-link">
              {t('My posts', '我的帖子', '我的帖子')}
            </Link>
            <Button variant="outline" onClick={onReload} disabled={loading}>
              {t('Check again', '重新检查', '重新檢查')}
            </Button>
          </div>
        </output>
      </section>
    );
  return (
    <section className="matches-panel" aria-busy={loading}>
      <div className="match-introduction">
        <Sparkles aria-hidden="true" />
        <p>
          {t(
            'Find complementary housing, item, study, transport and activity requests. Results use all your active posts.',
            '寻找宿舍、物品、学习、交通和活动方面的互补需求。匹配会考虑你所有有效帖子。',
            '尋找宿舍、物品、學習、交通和活動方面的互補需求。配對會考慮你所有有效帖子。',
          )}
        </p>
      </div>
      <div className="match-controls">
        <label className="match-kind-field">
          <span>{t('Match category', '匹配类别', '配對類別')}</span>
          <select
            value={kind}
            onChange={(event) => onKindChange(event.target.value as Category)}
          >
            {(
              ['all', 'hall', 'goods', 'study', 'transport', 'other'] as const
            ).map((value) => (
              <option key={value} value={value}>
                {labels[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="match-possible-toggle">
          <input
            type="checkbox"
            checked={includePossible}
            onChange={(event) => onPossibleChange(event.target.checked)}
          />
          <span>
            {t('Include possible matches', '包含待确认匹配', '包含待確認配對')}
            <small>
              {t(
                'Some details still need confirming',
                '部分条件仍需确认',
                '部分條件仍需確認',
              )}
            </small>
          </span>
        </label>
        <Button
          variant="outline"
          onClick={onReload}
          disabled={loading}
          className="match-refresh"
        >
          <RefreshCw aria-hidden="true" />
          {t('Refresh', '刷新', '重新整理')}
        </Button>
      </div>
      {data && !error && (
        <p className="match-overview">
          {t(
            `Across all categories: ${data.highConfidenceCount} clear matches · ${data.possibleCount} possible matches`,
            `全部类别：${data.highConfidenceCount} 条较明确匹配 · ${data.possibleCount} 条待确认匹配`,
            `全部類別：${data.highConfidenceCount} 則較明確配對 · ${data.possibleCount} 則待確認配對`,
          )}
        </p>
      )}
      {data && !error && data.needsDetails.length > 0 && (
        <details className="match-details-guide">
          <summary>
            <CircleHelp aria-hidden="true" />
            {t(
              `Add details to ${data.needsDetails.length} of your requests`,
              `${data.needsDetails.length} 条需求补充信息后更容易匹配`,
              `${data.needsDetails.length} 則需求補充資料後更容易配對`,
            )}
          </summary>
          <p>
            {t(
              'Be specific about what you offer or need, and any date, place or other requirements.',
              '写清你能提供什么、需要什么，以及日期、地点和其他要求。',
              '寫清你能提供甚麼、需要甚麼，以及日期、地點和其他要求。',
            )}
          </p>
          <ul>
            {data.needsDetails.map((post) => (
              <li key={post.id}>
                <div>
                  <strong>{post.title}</strong>
                  <p>
                    {matchMissingLabels(
                      post.missing.length ? post.missing : ['describe-request'],
                      locale,
                    ).join(' · ')}
                  </p>
                </div>
                <Link
                  href={`/posts/${encodeURIComponent(post.id)}/edit`}
                  className="match-text-link"
                >
                  {t('Add details', '补充信息', '補充資料')}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
      {error ? (
        <div className="section-empty match-empty" role="alert">
          <CircleHelp aria-hidden="true" />
          <strong>
            {t(
              'Could not load matches',
              '暂时无法加载匹配',
              '暫時無法載入配對',
            )}
          </strong>
          <p>
            {t(
              'Please retry. Your posts are still saved.',
              '请重试，你的帖子仍然保留。',
              '請重試，你的帖子仍然保留。',
            )}
          </p>
          <Button onClick={onReload}>{t('Retry', '重试', '重試')}</Button>
        </div>
      ) : !data ? (
        <output className="section-empty match-empty">
          <Sparkles aria-hidden="true" />
          <strong>
            {t(
              'Finding complementary requests…',
              '正在寻找互补需求…',
              '正在尋找互補需求…',
            )}
          </strong>
        </output>
      ) : data.items.length ? (
        <>
          <output className="match-results-heading">
            <span>
              {t(
                `${data.total} results in this view`,
                `当前条件下共 ${data.total} 条结果`,
                `目前條件下共 ${data.total} 則結果`,
              )}
            </span>
            <small>
              {t(
                'Confirm the details together in chat.',
                '具体安排请在聊天中共同确认。',
                '具體安排請在聊天中共同確認。',
              )}
            </small>
          </output>
          <div className="match-results">
            {data.items.map((item) => (
              <MatchResultCard
                key={item.id}
                item={item}
                locale={locale}
                onOpen={onOpen}
                onChat={onChat}
              />
            ))}
          </div>
        </>
      ) : (
        <output className="section-empty match-empty">
          <Sparkles aria-hidden="true" />
          <strong>
            {data.ownPostCount === 0
              ? t(
                  'Start with a request of your own',
                  '先发布一条自己的需求',
                  '先發佈一則自己的需求',
                )
              : t(
                  'No matches in this view yet',
                  '当前条件下暂时没有匹配',
                  '目前條件下暫時沒有配對',
                )}
          </strong>
          <p>
            {data.ownPostCount === 0
              ? t(
                  'Describe what you offer or need so NODE can look for complementary requests.',
                  '写清你能提供什么或需要什么，方便寻找互补需求。',
                  '寫清你能提供甚麼或需要甚麼，方便尋找互補需求。',
                )
              : t(
                  'New requests may bring new matches. Add missing details or try another category.',
                  '新帖子可能带来新匹配。也可以补充需求细节，或查看其他类别。',
                  '新帖子可能帶來新配對。也可以補充需求細節，或查看其他類別。',
                )}
          </p>
          <div className="match-empty-actions">
            <Link
              href={data.ownPostCount === 0 ? '/posts/new' : '/posts'}
              className="match-text-link"
            >
              {data.ownPostCount === 0
                ? labels.post
                : t('Review my posts', '查看我的帖子', '查看我的帖子')}
            </Link>
            {!includePossible && data.possibleCount > 0 && (
              <Button variant="outline" onClick={() => onPossibleChange(true)}>
                {t('See possible matches', '查看待确认匹配', '查看待確認配對')}
              </Button>
            )}
          </div>
        </output>
      )}
      {data && !error && (data.hasMore || page > 0) && (
        <nav
          className="match-pagination"
          aria-label={t('Match results pages', '匹配结果分页', '配對結果分頁')}
        >
          <Button
            variant="outline"
            disabled={loading || page === 0}
            onClick={() => onPageChange(page - 1)}
          >
            {t('Previous', '上一页', '上一頁')}
          </Button>
          <span>
            {t(`Page ${page + 1}`, `第 ${page + 1} 页`, `第 ${page + 1} 頁`)}
          </span>
          <Button
            variant="outline"
            disabled={loading || !data.hasMore}
            onClick={() => onPageChange(page + 1)}
          >
            {t('Next', '下一页', '下一頁')}
          </Button>
        </nav>
      )}
    </section>
  );
}

function MatchResultCard({
  item,
  locale,
  onOpen,
  onChat,
}: {
  item: MatchPayload;
  locale: Locale;
  onOpen: (item: RequestItem) => void;
  onChat: (item: RequestItem) => Promise<void>;
}) {
  const [chatPending, setChatPending] = useState(false);
  const request = mapPost(item);
  const match = item.match;
  const Icon = categoryMeta[match.kind].icon;
  const t = (en: string, cn: string, hk: string) =>
    localize(locale, en, cn, hk);
  const reasons = [
    ...new Set(match.reasons.map((reason) => matchReasonLabel(reason, locale))),
  ];
  const missing = matchMissingLabels(match.missing, locale, match.kind);
  return (
    <article className={`match-result-card match-${match.confidence}`}>
      <div className="match-card-topline">
        <span
          className="match-category"
          style={{ color: categoryMeta[match.kind].color }}
        >
          <Icon aria-hidden="true" />
          {copy[locale][match.kind]}
        </span>
        <span className={`match-confidence ${match.confidence}`}>
          {match.confidence === 'high' ? (
            <CheckCircle2 aria-hidden="true" />
          ) : (
            <CircleHelp aria-hidden="true" />
          )}
          {match.confidence === 'high'
            ? t('Clear match', '较明确匹配', '較明確配對')
            : t('Needs confirmation', '待确认匹配', '待確認配對')}
        </span>
      </div>
      <button className="match-post-preview" onClick={() => onOpen(request)}>
        <h2>{item.title}</h2>
        <p>{item.body}</p>
      </button>
      <p className="match-post-meta">
        {item.anonymousAlias} ·{' '}
        {getCampusLocationLabel(getCampusLocation(item.locationId), locale)} ·{' '}
        {request.age}
      </p>
      {reasons.length > 0 && (
        <ul className="match-reasons">
          {reasons.map((reason) => (
            <li key={reason}>
              <CheckCircle2 aria-hidden="true" />
              {reason}
            </li>
          ))}
        </ul>
      )}
      {missing.length > 0 && (
        <div className="match-missing">
          <strong>{t('Still to confirm', '仍需确认', '仍需確認')}</strong>
          <p>{missing.join(' · ')}</p>
        </div>
      )}
      <div className="match-card-actions">
        <Link
          href={`/posts/${encodeURIComponent(match.ownPostId)}/edit`}
          className="match-text-link"
        >
          {t('Review your request', '检查自己的需求', '檢查自己的需求')}
        </Link>
        <Button variant="outline" onClick={() => onOpen(request)}>
          {t('View request', '查看需求', '查看需求')}
        </Button>
        <Button
          disabled={chatPending}
          onClick={async () => {
            setChatPending(true);
            try {
              await onChat(request);
            } finally {
              setChatPending(false);
            }
          }}
        >
          <MessageCircle aria-hidden="true" />
          {chatPending
            ? t('Opening…', '正在打开…', '正在開啟…')
            : copy[locale].chat}
        </Button>
      </div>
    </article>
  );
}

export function RequestRow({
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

export function ConversationRow({
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
      {conversation.unreadCount > 0 && (
        <span
          className="unread-badge"
          aria-label={localize(
            locale,
            `${conversation.unreadCount} unread messages`,
            `${conversation.unreadCount} 条未读消息`,
            `${conversation.unreadCount} 則未讀訊息`,
          )}
        >
          {conversation.unreadCount}
        </span>
      )}
      <ChevronDown />
    </button>
  );
}

export function RequestDetail({
  item,
  t,
  locale,
  onChat,
  saved,
  onSave,
  onReport,
  page = false,
}: {
  item: RequestItem;
  t: (typeof copy)[Locale];
  locale: Locale;
  onChat: () => void;
  saved: boolean;
  onSave: () => void;
  onReport: () => void;
  page?: boolean;
}) {
  const Header = page ? 'header' : SheetHeader;
  const Title = page ? 'h2' : SheetTitle;
  const Description = page ? 'p' : SheetDescription;
  const meta = categoryMeta[item.category];
  const Icon = meta.icon;
  return (
    <>
      <Header className="detail-header">
        <div className="detail-category" style={{ color: meta.color }}>
          <Icon /> {t[item.category]}
        </div>
        <Title>{item.title}</Title>
        <Description>
          {localize(
            locale,
            `Posted by ${item.author} · ${item.age} ago`,
            `由 ${item.author} 发布 · ${item.age} 前`,
            `由 ${item.author} 發佈 · ${item.age} 前`,
          )}
        </Description>
      </Header>
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
