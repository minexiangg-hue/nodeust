'use client';

import {
  ArrowLeftRight,
  Bookmark,
  ChevronDown,
  Flag,
  Map,
  MapPin,
  MessageCircle,
  ShieldCheck,
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
  type RequestItem,
  type ConversationItem,
} from '@/lib/community-model';
import { localize, type Locale } from '@/lib/locale';

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
