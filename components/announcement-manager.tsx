'use client';

import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ConfirmAction,
  ListState,
  mutateRecord,
  Pager,
  usePagedItems,
} from '@/components/record-tools';
import { localize, recordStatusLabel, type Locale } from '@/lib/locale';

type Announcement = {
  id: string;
  title: string;
  body: string;
  kind: string;
  status: string;
  publishedAt: string | null;
};

export function AnnouncementManager({
  locale,
  isOwner,
  onChanged,
}: {
  locale: Locale;
  isOwner: boolean;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState('info');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState('');
  const [version, setVersion] = useState(0);
  const publish = async () => {
    if (lock.current || !title.trim() || !body.trim()) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    try {
      await mutateRecord('/api/announcements', 'POST', { title, body, kind });
      setTitle('');
      setBody('');
      setVersion((value) => value + 1);
      onChanged();
      setMessage(localize(locale, 'Published.', '已发布。', '已發佈。'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to publish.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <form
        className="announcement-admin-card"
        onSubmit={(event) => {
          event.preventDefault();
          void publish();
        }}
      >
        <h3>
          {localize(locale, 'Publish an announcement', '发布公告', '發佈公告')}
        </h3>
        <Select
          value={kind}
          onValueChange={(value) => {
            if (value) setKind(value);
          }}
        >
          <SelectTrigger
            aria-label={localize(
              locale,
              'Announcement type',
              '公告类型',
              '公告類型',
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="info">
              {localize(locale, 'Information', '通知', '通知')}
            </SelectItem>
            <SelectItem value="upgrade">
              {localize(locale, 'Upgrade', '升级', '升級')}
            </SelectItem>
            <SelectItem value="maintenance">
              {localize(locale, 'Maintenance', '维护', '維護')}
            </SelectItem>
          </SelectContent>
        </Select>
        <Input
          required
          maxLength={160}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label={localize(
            locale,
            'Announcement title',
            '公告标题',
            '公告標題',
          )}
          placeholder={localize(
            locale,
            'Announcement title',
            '公告标题',
            '公告標題',
          )}
        />
        <Textarea
          required
          value={body}
          onChange={(event) => setBody(event.target.value)}
          aria-label={localize(
            locale,
            'Announcement content',
            '公告内容',
            '公告內容',
          )}
          placeholder={localize(
            locale,
            'What should the community know?',
            '需要向社区说明什么？',
            '需要向社群說明甚麼？',
          )}
        />
        <Button type="submit" disabled={busy || !title.trim() || !body.trim()}>
          {busy
            ? localize(locale, 'Publishing…', '发布中…', '發佈中…')
            : localize(locale, 'Publish', '发布', '發佈')}
        </Button>
        {message && <output>{message}</output>}
      </form>
      {isOwner && (
        <AnnouncementHistory
          key={version}
          locale={locale}
          onChanged={onChanged}
        />
      )}
    </>
  );
}

function AnnouncementHistory({
  locale,
  onChanged,
}: {
  locale: Locale;
  onChanged: () => void;
}) {
  const list = usePagedItems<Announcement>('/api/announcements?manage=1');
  return (
    <section>
      <h3>
        {localize(locale, 'Announcement history', '历史公告', '歷史公告')}
      </h3>
      <ListState
        {...list}
        empty={!list.items.length}
        retry={list.refresh}
        locale={locale}
      />
      <div className="records-list">
        {list.items.map((item) => (
          <article className="record-card" key={item.id}>
            <div className="record-meta">
              <Badge variant="outline">
                {recordStatusLabel(item.status, locale)}
              </Badge>
              {item.publishedAt && (
                <time>{new Date(item.publishedAt).toLocaleString(locale)}</time>
              )}
            </div>
            <h4>{item.title}</h4>
            <details>
              <summary>
                {localize(
                  locale,
                  'Read announcement',
                  '查看公告内容',
                  '查看公告內容',
                )}
              </summary>
              <p className="record-body">{item.body}</p>
            </details>
            <div className="record-actions">
              <ConfirmAction
                locale={locale}
                label={localize(
                  locale,
                  'Delete announcement',
                  '删除公告',
                  '刪除公告',
                )}
                description={localize(
                  locale,
                  'Permanently delete this announcement, including its public display. This cannot be undone.',
                  '永久删除这条公告，同时从公告栏移除，无法撤销。',
                  '永久刪除這條公告，同時從公告欄移除，無法撤銷。',
                )}
                onConfirm={async () => {
                  await mutateRecord('/api/announcements', 'DELETE', {
                    id: item.id,
                  });
                  list.refresh();
                  onChanged();
                }}
              />
            </div>
          </article>
        ))}
      </div>
      <Pager {...list} locale={locale} />
    </section>
  );
}
