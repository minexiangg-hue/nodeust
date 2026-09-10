'use client';

import { useEffect, useRef, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { type Announcement } from '@/lib/community-model';
import { localize, type Locale } from '@/lib/locale';

export function AnnouncementBoard({
  announcements,
  locale,
  onRead,
  open,
}: {
  announcements: Announcement[];
  locale: Locale;
  onRead: (items: Announcement[]) => void;
  open: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const readRef = useRef(onRead);
  useEffect(() => {
    readRef.current = onRead;
  }, [onRead]);
  useEffect(() => {
    if (!open) return;
    if (expanded && document.visibilityState === 'visible')
      readRef.current(announcements);
  }, [open, expanded, announcements]);
  const visible = expanded ? announcements : [];
  return (
    <section className="announcement-board" aria-label="Announcements">
      <div className="announcement-heading">
        <span>
          <Megaphone /> {localize(locale, 'Announcements', '公告栏', '公告欄')}
        </span>
        {announcements.length > 0 && (
          <button
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded
              ? localize(locale, 'Collapse', '收起', '收起')
              : localize(
                  locale,
                  `View all ${announcements.length}`,
                  `查看全部 ${announcements.length} 条`,
                  `查看全部 ${announcements.length} 條`,
                )}
          </button>
        )}
      </div>
      {visible.length ? (
        visible.map((announcement) => (
          <article
            key={announcement.id}
            className={`announcement-item announcement-${announcement.kind}`}
          >
            <Badge variant="secondary">{announcement.kind}</Badge>
            <strong>{announcement.title}</strong>
            <p>{announcement.body}</p>
          </article>
        ))
      ) : announcements.length === 0 ? (
        <p className="announcement-empty">
          {localize(
            locale,
            'No active announcements.',
            '当前没有公告。',
            '目前沒有公告。',
          )}
        </p>
      ) : null}
    </section>
  );
}
