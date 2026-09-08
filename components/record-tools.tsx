'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { localize, type Locale } from '@/lib/locale';

export async function mutateRecord(
  url: string,
  method: string,
  body?: unknown,
) {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}

/** Abort stale page/filter requests so a late response cannot replace the current list. */
export function usePagedItems<T>(url: string) {
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const key = `${url}&page=${page}&revision=${revision}`;
  const [data, setData] = useState<{
    key: string;
    items: T[];
    hasMore: boolean;
    error: boolean;
  }>({
    key: '',
    items: [],
    hasMore: false,
    error: false,
  });
  useEffect(() => {
    const controller = new AbortController();
    fetch(key, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load records.');
        return response.json() as Promise<{ items: T[]; hasMore?: boolean }>;
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!result.items.length && page > 0) {
          setPage(page - 1);
          return;
        }
        setData({
          key,
          items: result.items,
          hasMore: Boolean(result.hasMore),
          error: false,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setData({ key, items: [], hasMore: false, error: true });
      });
    return () => controller.abort();
  }, [key, page]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const loading = data.key !== key;
  return {
    items: loading ? [] : data.items,
    hasMore: !loading && data.hasMore,
    error: !loading && data.error,
    loading,
    page,
    setPage,
    refresh,
  };
}

export function Pager({
  page,
  hasMore,
  loading,
  setPage,
  locale,
}: {
  page: number;
  hasMore: boolean;
  loading: boolean;
  setPage: (page: number) => void;
  locale: Locale;
}) {
  return (
    <nav
      className="records-pager"
      aria-label={localize(locale, 'Pagination', '分页', '分頁')}
    >
      <Button
        variant="outline"
        disabled={loading || page === 0}
        onClick={() => setPage(page - 1)}
      >
        {localize(locale, 'Previous', '上一页', '上一頁')}
      </Button>
      <span>
        {localize(
          locale,
          `Page ${page + 1}`,
          `第 ${page + 1} 页`,
          `第 ${page + 1} 頁`,
        )}
      </span>
      <Button
        variant="outline"
        disabled={loading || !hasMore}
        onClick={() => setPage(page + 1)}
      >
        {localize(locale, 'Next', '下一页', '下一頁')}
      </Button>
    </nav>
  );
}

export function ListState({
  loading,
  error,
  empty,
  retry,
  locale,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  retry: () => void;
  locale: Locale;
}) {
  if (loading)
    return (
      <output>{localize(locale, 'Loading…', '加载中…', '載入中…')}</output>
    );
  if (error)
    return (
      <div role="alert" className="queue-error">
        <p>
          {localize(
            locale,
            'Unable to load records. Please sign in or try again.',
            '无法加载，请确认已登录或重试。',
            '無法載入，請確認已登入或重試。',
          )}
        </p>
        <Button variant="outline" onClick={retry}>
          {localize(locale, 'Retry', '重试', '重試')}
        </Button>
      </div>
    );
  return empty ? (
    <p className="queue-empty">
      {localize(
        locale,
        'No records in this view.',
        '此视图暂无记录。',
        '此檢視暫無記錄。',
      )}
    </p>
  ) : null;
}

export function ConfirmAction({
  label,
  description,
  onConfirm,
  locale,
  destructive = true,
}: {
  label: string;
  description: string;
  onConfirm: () => Promise<void>;
  locale: Locale;
  destructive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const confirm = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      setOpen(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Request failed.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) {
          setOpen(next);
          setError('');
        }
      }}
    >
      <AlertDialogTrigger
        render={
          <Button size="sm" variant={destructive ? 'destructive' : 'outline'} />
        }
      >
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="queue-error">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>
            {localize(locale, 'Cancel', '取消', '取消')}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            disabled={busy}
            onClick={() => void confirm()}
          >
            {busy
              ? localize(locale, 'Working…', '处理中…', '處理中…')
              : localize(locale, 'Confirm', '确认', '確認')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
