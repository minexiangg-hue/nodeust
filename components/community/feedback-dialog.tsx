'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  feedbackCategoryLabel,
  type FeedbackCategory,
} from '@/lib/community-model';
import { localize, type Locale } from '@/lib/locale';

export function FeedbackDialog({
  locale,
  onClose,
  onSent,
}: {
  locale: Locale;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const [category, setCategory] = useState<FeedbackCategory>('suggestion');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category, body: text }),
      });
      if (!response.ok) throw new Error('send failed');
      onSent(
        localize(
          locale,
          'Feedback sent. Thank you!',
          '反馈已发送，谢谢！',
          '反饋已送出，多謝！',
        ),
      );
    } catch {
      setError(
        localize(
          locale,
          'Could not send feedback. Please try again.',
          '发送失败，请稍后再试。',
          '傳送失敗，請稍後再試。',
        ),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <DialogContent className="create-dialog">
      <DialogHeader>
        <DialogTitle>
          {localize(locale, 'Send feedback', '发送反馈', '發送反饋')}
        </DialogTitle>
        <DialogDescription>
          {localize(
            locale,
            'Tell the NODE team what to fix or improve. Your username is visible to the Owner only — other members stay anonymous.',
            '告诉我们如何改进 NODE。你的用户名只对 Owner 可见，对其他成员保持匿名。',
            '話畀我哋知點樣改進 NODE。你嘅用戶名只對 Owner 可見，其他成員保持匿名。',
          )}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={(event) => void submit(event)}>
        <div className="create-form">
          <div className="form-field">
            <label htmlFor="feedback-category">
              {localize(locale, 'Type', '类型', '類型')}
            </label>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as FeedbackCategory)}
            >
              <SelectTrigger id="feedback-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">
                  {feedbackCategoryLabel('bug', locale)}
                </SelectItem>
                <SelectItem value="suggestion">
                  {feedbackCategoryLabel('suggestion', locale)}
                </SelectItem>
                <SelectItem value="other">
                  {feedbackCategoryLabel('other', locale)}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="form-field">
            <label htmlFor="feedback-body">
              {localize(locale, 'Feedback', '反馈内容', '反饋內容')}
            </label>
            <Textarea
              id="feedback-body"
              required
              rows={5}
              maxLength={2000}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={localize(
                locale,
                'Describe the issue or your suggestion…',
                '描述问题或建议…',
                '描述問題或建議…',
              )}
            />
            <small className="field-hint">{body.length}/2000</small>
          </div>
          {error && <div className="queue-error">{error}</div>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {localize(locale, 'Cancel', '取消', '取消')}
          </Button>
          <Button type="submit" disabled={!body.trim() || sending}>
            {sending
              ? localize(locale, 'Sending…', '发送中…', '傳送中…')
              : localize(locale, 'Send feedback', '发送反馈', '發送反饋')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
