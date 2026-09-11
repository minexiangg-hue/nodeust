'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  campusLocations,
  getCampusLocation,
  getCampusLocationLabel,
  getLocationGroupLabel,
  locationGroups,
} from '@/lib/campus-locations';
import { copy, type Category, type RequestItem } from '@/lib/community-model';
import { localize, type Locale } from '@/lib/locale';

export function PostEditor({
  t,
  locale,
  onCreated,
  currentLocationId,
  authorAlias,
  initial,
  editing,
  onSaveDraft,
  onLocationChange,
  locationSaving,
  onChange,
}: {
  t: (typeof copy)[Locale];
  locale: Locale;
  onCreated: (item: RequestItem) => Promise<void>;
  currentLocationId: string;
  authorAlias: string;
  initial?: RequestItem;
  editing: boolean;
  locationSaving: boolean;
  onSaveDraft: (item: RequestItem) => void;
  onLocationChange: (id: string) => Promise<boolean>;
  onChange?: (item: RequestItem) => void;
}) {
  const [postCategory, setPostCategory] = useState<Exclude<Category, 'all'>>(
    initial?.category ?? 'hall',
  );
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    detail: initial?.detail ?? '',
    from: initial?.from ?? '',
    to: initial?.to ?? '',
    locationId: initial?.locationId ?? currentLocationId,
  });
  const [busy, setBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [error, setError] = useState('');
  const initialId = initial?.id ?? '';
  const item = useCallback(
    (): RequestItem => ({
      ...form,
      id: initialId,
      category: postCategory,
      author: authorAlias,
      age: 'now',
      replies: 0,
      mine: true,
      hall: form.from,
    }),
    [form, initialId, postCategory, authorAlias],
  );
  const changedRef = useRef(onChange);
  useEffect(() => {
    changedRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    changedRef.current?.(item());
  }, [item]);
  const changeLocation = async (locationId: string) => {
    setLocationBusy(true);
    setError('');
    try {
      if (await onLocationChange(locationId))
        setForm((current) => ({ ...current, locationId }));
      else
        setError(
          localize(
            locale,
            'Could not update location. Try again.',
            '地点更新失败，请重试。',
            '地點更新失敗，請重試。',
          ),
        );
    } finally {
      setLocationBusy(false);
    }
  };
  return (
    <article className="post-editor-page create-dialog">
      <header className="post-editor-header">
        <h2>
          {editing
            ? localize(locale, 'Edit post', '编辑帖子', '編輯帖子')
            : t.post}
        </h2>
        <p>
          {localize(
            locale,
            'Share only what a match needs. Do not post room numbers, student IDs or contact details.',
            '只填写匹配所需信息；房号、学号和联系方式请勿公开。',
            '只填寫配對所需資訊；房號、學號和聯絡方式請勿公開。',
          )}
        </p>
      </header>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || locationBusy || locationSaving) return;
          setBusy(true);
          setError('');
          try {
            await onCreated(item());
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : localize(
                    locale,
                    'Could not save. Try again.',
                    '保存失败，请重试。',
                    '儲存失敗，請重試。',
                  ),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset
          className="create-form"
          disabled={busy || locationBusy || locationSaving}
        >
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
                <SelectValue>{t[postCategory]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hall">{t.hall}</SelectItem>
                <SelectItem value="goods">{t.goods}</SelectItem>
                <SelectItem value="study">{t.study}</SelectItem>
                <SelectItem value="transport">{t.transport}</SelectItem>
                <SelectItem value="other">{t.other}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="form-field">
            <label htmlFor="post-location">
              {localize(locale, 'Location', '发布地点', '發佈地點')}
            </label>
            <Select
              name="locationId"
              value={form.locationId}
              disabled={busy || locationBusy || locationSaving}
              onValueChange={(value) => {
                if (value && value !== form.locationId)
                  void changeLocation(value);
              }}
            >
              <SelectTrigger id="post-location">
                <SelectValue>
                  {getCampusLocationLabel(
                    getCampusLocation(form.locationId),
                    locale,
                  )}
                </SelectValue>
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
                'Changing this also updates your location tag on the plaza. No GPS.',
                '更改这里也会同步更新广场中的个人地点标签，不读取 GPS。',
                '更改這裡也會同步更新廣場中的個人地點標籤，不讀取 GPS。',
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
                  value={form.from}
                  maxLength={80}
                  onChange={(event) =>
                    setForm({ ...form, from: event.target.value })
                  }
                  required
                  placeholder="Hall VII"
                />
              </div>
              <div className="form-field">
                <label htmlFor="post-to">
                  {localize(locale, 'Wanted hall', '目标宿舍', '目標宿舍')}
                </label>
                <Input
                  id="post-to"
                  name="to"
                  required
                  placeholder="Hall III"
                  maxLength={80}
                  value={form.to}
                  onChange={(event) =>
                    setForm({ ...form, to: event.target.value })
                  }
                />
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
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
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
              value={form.detail}
              onChange={(event) =>
                setForm({ ...form, detail: event.target.value })
              }
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
              <Link href="/rules">
                {localize(
                  locale,
                  'Read all rules',
                  '查看完整规则',
                  '查看完整規則',
                )}
              </Link>
            </p>
          </div>
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="post-editor-actions">
          {!editing && (
            <Button
              type="button"
              variant="outline"
              disabled={busy || locationBusy || locationSaving}
              onClick={() => {
                try {
                  onSaveDraft(item());
                } catch {
                  setError(
                    localize(
                      locale,
                      'Could not save the draft. Check browser storage and try again.',
                      '草稿保存失败，请检查浏览器存储后重试。',
                      '草稿儲存失敗，請檢查瀏覽器儲存空間後重試。',
                    ),
                  );
                }
              }}
            >
              {localize(locale, 'Save draft', '保存草稿', '儲存草稿')}
            </Button>
          )}
          <Button
            type="submit"
            disabled={busy || locationBusy || locationSaving}
          >
            <Plus />{' '}
            {busy
              ? localize(locale, 'Saving…', '保存中…', '儲存中…')
              : editing
                ? localize(locale, 'Save changes', '保存修改', '儲存修改')
                : localize(locale, 'Publish', '发布到广场', '發佈到廣場')}
          </Button>
        </div>
      </form>
    </article>
  );
}
