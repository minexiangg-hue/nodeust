'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  categoryLabel,
  recordStatusLabel,
  localize,
  type Locale,
} from '@/lib/locale';

type MyPost = {
  id: string;
  title: string;
  body: string;
  category: 'hall' | 'goods' | 'study' | 'other';
  status: 'active' | 'closed' | 'matched' | 'removed';
  createdAt: string;
};

export function MyPosts({
  locale,
  onChanged,
  onCreate,
}: {
  locale: Locale;
  onChanged: () => void;
  onCreate: () => void;
}) {
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  return (
    <section className="my-posts-panel">
      <p>
        {localize(
          locale,
          'Manage your requests. Closing hides a post; deleting removes it from the plaza without deleting existing conversations.',
          '管理自己发布的需求。关闭后可重新展示；删除后从广场下架，但保留已有对话。',
          '管理自己發佈的需求。關閉後可重新展示；刪除後從廣場下架，但保留已有對話。',
        )}
      </p>
      <div className="records-toolbar">
        <Input
          aria-label={localize(
            locale,
            'Search my posts',
            '搜索我的帖子',
            '搜尋我的帖子',
          )}
          placeholder={localize(
            locale,
            'Search my posts',
            '搜索我的帖子',
            '搜尋我的帖子',
          )}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          value={status}
          onValueChange={(value) => {
            if (value) setStatus(value);
          }}
        >
          <SelectTrigger
            aria-label={localize(locale, 'Post status', '帖子状态', '帖子狀態')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['all', 'active', 'closed', 'matched', 'removed'].map((value) => (
              <SelectItem key={value} value={value}>
                {value === 'all'
                  ? localize(locale, 'All statuses', '全部状态', '全部狀態')
                  : recordStatusLabel(value, locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={onCreate}>
          {localize(locale, 'New request', '发布需求', '發佈需求')}
        </Button>
      </div>
      <MyPostList
        key={`${status}:${query}`}
        url={`/api/posts?mine=1&status=${status}&q=${encodeURIComponent(query)}`}
        locale={locale}
        onChanged={onChanged}
      />
    </section>
  );
}

function MyPostList({
  url,
  locale,
  onChanged,
}: {
  url: string;
  locale: Locale;
  onChanged: () => void;
}) {
  const list = usePagedItems<MyPost>(url);
  const act = async (post: MyPost, action: 'close' | 'reopen' | 'delete') => {
    await mutateRecord(
      `/api/posts/${encodeURIComponent(post.id)}`,
      action === 'delete' ? 'DELETE' : 'PATCH',
      action === 'delete' ? undefined : { action },
    );
    list.refresh();
    onChanged();
  };
  return (
    <>
      <Button
        variant="ghost"
        className="records-refresh"
        disabled={list.loading}
        onClick={list.refresh}
      >
        {localize(locale, 'Refresh', '刷新', '重新整理')}
      </Button>
      <ListState
        {...list}
        empty={!list.items.length}
        retry={list.refresh}
        locale={locale}
      />
      <div className="records-list">
        {list.items.map((post) => (
          <article className="record-card" key={post.id}>
            <div className="record-meta">
              <Badge variant="secondary">
                {categoryLabel(post.category, locale)}
              </Badge>
              <Badge variant="outline">
                {recordStatusLabel(post.status, locale)}
              </Badge>
              <time>{new Date(post.createdAt).toLocaleString(locale)}</time>
            </div>
            <h3>{post.title}</h3>
            <p className="record-body">{post.body}</p>
            <div className="record-actions">
              {(post.status === 'active' || post.status === 'closed') && (
                <ConfirmAction
                  locale={locale}
                  destructive={false}
                  label={
                    post.status === 'active'
                      ? localize(locale, 'Close post', '关闭帖子', '關閉帖子')
                      : localize(locale, 'Reopen post', '重新展示', '重新展示')
                  }
                  description={localize(
                    locale,
                    'Change whether this post appears in the plaza. Existing conversations are kept.',
                    '调整帖子是否在广场展示，保留已有对话。',
                    '調整帖子是否在廣場展示，保留已有對話。',
                  )}
                  onConfirm={() =>
                    act(post, post.status === 'active' ? 'close' : 'reopen')
                  }
                />
              )}
              {post.status !== 'removed' && (
                <ConfirmAction
                  locale={locale}
                  label={localize(
                    locale,
                    'Delete post',
                    '删除帖子',
                    '刪除帖子',
                  )}
                  description={localize(
                    locale,
                    'This post cannot be reopened after deletion. Existing conversations and moderation records are retained.',
                    '删除后不能重新展示此帖。已有对话和审核记录会保留。',
                    '刪除後不能重新展示此帖。已有對話和審核記錄會保留。',
                  )}
                  onConfirm={() => act(post, 'delete')}
                />
              )}
            </div>
          </article>
        ))}
      </div>
      <Pager {...list} locale={locale} />
    </>
  );
}
