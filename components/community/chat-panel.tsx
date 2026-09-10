'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Send,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  formatClock,
  type ChatSession,
  type WireMessage,
} from '@/lib/community-model';
import { localize, type Locale } from '@/lib/locale';

export function ChatPanel({
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
  const [peerReadAt, setPeerReadAt] = useState<string | null>(null);
  const [myReadAt, setMyReadAt] = useState<string | null>(null);
  const acknowledged = useRef('');
  const reading = useRef(false);
  const mounted = useRef(true);
  const followNewest = useRef(true);
  const changedRef = useRef(onConversationChanged);
  useEffect(() => {
    changedRef.current = onConversationChanged;
  }, [onConversationChanged]);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<WireMessage[]>([]);
  const [busy, setBusy] = useState<
    'sending' | 'requesting' | 'accepting' | null
  >(null);
  const [actionError, setActionError] = useState('');
  const streamRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const response = await fetch(
        `/api/conversations/${session.conversationId}/messages`,
      );
      if (!response.ok) return;
      const result = (await response.json()) as {
        items?: WireMessage[];
        peerReadAt: string | null;
        myReadAt: string | null;
      };
      if (!mounted.current) return;
      setMessages(result.items ?? []);
      setPeerReadAt(result.peerReadAt);
      setMyReadAt((current) =>
        current && (!result.myReadAt || current > result.myReadAt)
          ? current
          : result.myReadAt,
      );
    } catch {
      /* Keep what we have; the next poll retries. */
    }
  }, [session.conversationId]);

  useEffect(() => {
    mounted.current = true;
    // Cancel the initial poll as well if navigation immediately unmounts the chat.
    const initialPoll = setTimeout(() => void load(), 0);
    const id = setInterval(() => void load(), 4000);
    const visible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      mounted.current = false;
      clearTimeout(initialPoll);
      clearInterval(id);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [load]);

  const newestId = messages.at(-1)?.id;
  useEffect(() => {
    const el = streamRef.current;
    if (el && followNewest.current) el.scrollTop = el.scrollHeight;
  }, [newestId]);

  useEffect(() => {
    const stream = streamRef.current;
    const newest = messages.at(-1);
    if (!stream || !newest) return;
    const markVisible = async () => {
      if (
        !mounted.current ||
        document.visibilityState !== 'visible' ||
        reading.current ||
        acknowledged.current === newest.id ||
        stream.scrollHeight - stream.scrollTop - stream.clientHeight > 24
      )
        return;
      reading.current = true;
      try {
        const response = await fetch(
          `/api/conversations/${session.conversationId}/messages`,
          {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ messageId: newest.id }),
          },
        );
        if (response.ok && mounted.current) {
          acknowledged.current = newest.id;
          setMyReadAt((current) =>
            current && current > newest.createdAt ? current : newest.createdAt,
          );
          changedRef.current();
        }
      } catch {
        /* Retry on the next visible poll. */
      } finally {
        reading.current = false;
      }
    };
    void markVisible();
    stream.addEventListener('scroll', markVisible);
    document.addEventListener('visibilitychange', markVisible);
    return () => {
      stream.removeEventListener('scroll', markVisible);
      document.removeEventListener('visibilitychange', markVisible);
    };
  }, [messages, session.conversationId]);

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

  const reveals = messages.filter(
    (message) => message.kind === 'contact_reveal',
  );
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
      <header className="chat-header">
        <div className="chat-peer">
          <div className="mini-avatar">{session.peerAlias.slice(0, 1)}</div>
          <div>
            <h2>{session.peerAlias}</h2>
            <p>
              <ShieldCheck aria-hidden="true" />{' '}
              {localize(locale, 'Private conversation', '私密会话', '私密會話')}
            </p>
          </div>
        </div>
      </header>
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
      <div
        className="message-stream"
        ref={streamRef}
        onScroll={() => {
          const el = streamRef.current;
          if (el)
            followNewest.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
      >
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
              {localize(locale, 'No messages yet', '还没有消息', '還沒有訊息')}
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
              <span>
                {formatClock(message.createdAt)} ·{' '}
                {(() => {
                  const readAt = message.isMine ? peerReadAt : myReadAt;
                  const read = Boolean(readAt && message.createdAt <= readAt);
                  return (
                    <span className="message-receipt">
                      {!read && <i className="unread-dot" aria-hidden="true" />}
                      {read
                        ? localize(locale, 'Read', '已读', '已讀')
                        : localize(locale, 'Unread', '未读', '未讀')}
                    </span>
                  );
                })()}
              </span>
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
