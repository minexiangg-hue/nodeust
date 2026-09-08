'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ConfirmAction,
  ListState,
  mutateRecord,
  Pager,
  usePagedItems,
} from '@/components/record-tools';
import {
  localize,
  recordStatusLabel,
  reportReasonLabel,
  type Locale,
} from '@/lib/locale';

type Review = {
  id: string;
  status: string;
  targetType: 'post' | 'message' | 'user';
  targetLabel: string;
  targetAlias: string;
  reporterAlias: string;
  reason: string;
  details: string | null;
  createdAt: string;
};
type Feedback = {
  id: string;
  status: 'open' | 'resolved';
  category: string;
  body: string;
  username: string;
  alias: string;
  createdAt: string;
};

export function AdminRecords({
  kind,
  locale,
  isOwner,
  onPostsChanged,
}: {
  kind: 'reports' | 'feedback';
  locale: Locale;
  isOwner: boolean;
  onPostsChanged: () => void;
}) {
  const [filter, setFilter] = useState('open');
  const filters =
    kind === 'reports' ? ['open', 'processed'] : ['open', 'resolved', 'all'];
  return (
    <>
      <div className="records-toolbar">
        {filters.map((value) => (
          <Button
            key={value}
            variant={filter === value ? 'default' : 'outline'}
            onClick={() => setFilter(value)}
          >
            {value === 'all'
              ? localize(locale, 'All', '全部', '全部')
              : value === 'processed'
                ? localize(locale, 'Processed', '已处理', '已處理')
                : recordStatusLabel(value, locale)}
          </Button>
        ))}
      </div>
      <p className="records-hint">
        {localize(
          locale,
          'Process open items first. Owner can permanently delete completed records; moderation action logs are kept.',
          '请先处理待办事项。Owner 可永久删除已处理记录；审核操作日志会保留。',
          '請先處理待辦事項。Owner 可永久刪除已處理記錄；審核操作日誌會保留。',
        )}
      </p>
      <RecordList
        key={`${kind}:${filter}`}
        kind={kind}
        filter={filter}
        locale={locale}
        isOwner={isOwner}
        onPostsChanged={onPostsChanged}
      />
    </>
  );
}

function RecordList({
  kind,
  filter,
  locale,
  isOwner,
  onPostsChanged,
}: {
  kind: 'reports' | 'feedback';
  filter: string;
  locale: Locale;
  isOwner: boolean;
  onPostsChanged: () => void;
}) {
  const endpoint = kind === 'reports' ? '/api/admin/reports' : '/api/feedback';
  const list = usePagedItems<Review | Feedback>(`${endpoint}?status=${filter}`);
  const act = async (id: string, action: string) => {
    await mutateRecord(
      endpoint,
      action === 'delete' ? 'DELETE' : 'PATCH',
      action === 'delete'
        ? { id }
        : kind === 'reports'
          ? {
              reportId: id,
              action,
              reason:
                action === 'remove'
                  ? 'Post removed by the moderation team.'
                  : 'Report dismissed by the moderation team.',
            }
          : { id, action },
    );
    list.refresh();
    if (kind === 'reports' && action === 'remove') onPostsChanged();
  };
  const actionButton = (
    id: string,
    action: string,
    label: string,
    description: string,
    destructive = false,
  ) => (
    <ConfirmAction
      locale={locale}
      label={label}
      description={description}
      destructive={destructive}
      onConfirm={() => act(id, action)}
    />
  );
  return (
    <>
      <Button
        className="records-refresh"
        variant="ghost"
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
        {list.items.map((item) => (
          <article className="record-card" key={item.id}>
            <div className="record-meta">
              <Badge variant="secondary">
                {recordStatusLabel(item.status, locale)}
              </Badge>
              <time>{new Date(item.createdAt).toLocaleString(locale)}</time>
            </div>
            {'body' in item ? (
              <>
                <h3>
                  {item.username}{' '}
                  <span className="records-hint">{item.alias}</span>
                </h3>
                <Badge variant="outline">
                  {item.category === 'bug'
                    ? localize(locale, 'Bug', '故障', '故障')
                    : item.category === 'suggestion'
                      ? localize(locale, 'Suggestion', '建议', '建議')
                      : localize(locale, 'Other', '其他', '其他')}
                </Badge>
                <p className="record-body">{item.body}</p>
              </>
            ) : (
              <>
                <h3>
                  {item.targetLabel ||
                    item.targetAlias ||
                    localize(
                      locale,
                      'Content unavailable',
                      '内容不可用',
                      '內容不可用',
                    )}
                </h3>
                <p className="records-hint">
                  {item.targetType === 'post'
                    ? localize(locale, 'Post', '帖子', '帖子')
                    : item.targetType === 'user'
                      ? localize(locale, 'User', '用户', '用戶')
                      : localize(locale, 'Message', '消息', '訊息')}{' '}
                  · {reportReasonLabel(item.reason, locale)} ·{' '}
                  {item.reporterAlias}
                </p>
                {item.details && <p className="record-body">{item.details}</p>}
              </>
            )}
            <div className="record-actions">
              {'body' in item
                ? actionButton(
                    item.id,
                    item.status === 'open' ? 'resolve' : 'reopen',
                    item.status === 'open'
                      ? localize(
                          locale,
                          'Mark resolved',
                          '标记已处理',
                          '標記已處理',
                        )
                      : localize(locale, 'Reopen', '重新打开', '重新開啟'),
                    localize(
                      locale,
                      'Update the processing status of this feedback.',
                      '更新这条反馈的处理状态。',
                      '更新這條反饋的處理狀態。',
                    ),
                  )
                : item.status === 'open' && (
                    <>
                      {item.targetType === 'post' &&
                        actionButton(
                          item.id,
                          'remove',
                          localize(
                            locale,
                            'Remove post',
                            '移除帖子',
                            '移除帖子',
                          ),
                          localize(
                            locale,
                            'Remove the reported post from the plaza and resolve this report. Existing conversations are kept.',
                            '从广场移除被举报帖子并完成审核，保留已有对话。',
                            '從廣場移除被舉報帖子並完成審核，保留已有對話。',
                          ),
                          true,
                        )}
                      {actionButton(
                        item.id,
                        'dismiss',
                        localize(
                          locale,
                          'Dismiss report',
                          '忽略举报',
                          '忽略舉報',
                        ),
                        localize(
                          locale,
                          'Close this report without changing the reported content.',
                          '结束此举报，不修改被举报内容。',
                          '結束此舉報，不修改被舉報內容。',
                        ),
                      )}
                    </>
                  )}
              {isOwner &&
                item.status !== 'open' &&
                actionButton(
                  item.id,
                  'delete',
                  localize(locale, 'Delete record', '删除记录', '刪除記錄'),
                  localize(
                    locale,
                    'Permanently delete this completed record. This cannot be undone. Moderation action logs are kept.',
                    '永久删除这条已处理记录，无法撤销。审核操作日志会保留。',
                    '永久刪除這條已處理記錄，無法撤銷。審核操作日誌會保留。',
                  ),
                  true,
                )}
            </div>
          </article>
        ))}
      </div>
      <Pager {...list} locale={locale} />
    </>
  );
}
