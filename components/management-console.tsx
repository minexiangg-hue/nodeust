'use client';

import { useState } from 'react';
import { Megaphone, MessageSquarePlus, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { AdminRecords } from '@/components/admin-records';
import { AnnouncementManager } from '@/components/announcement-manager';
import { localize, type Locale } from '@/lib/locale';

export function ManagementConsole({
  locale,
  isOwner,
  onAnnouncementsChanged,
  onPostsChanged,
  page = false,
}: {
  locale: Locale;
  isOwner: boolean;
  onAnnouncementsChanged: () => void;
  onPostsChanged: () => void;
  page?: boolean;
}) {
  const Header = page ? 'header' : SheetHeader;
  const Title = page ? 'h2' : SheetTitle;
  const Description = page ? 'p' : SheetDescription;
  const [active, setActive] = useState<string | null>(null);
  const sections = [
    {
      key: 'announcements',
      title: localize(locale, 'Announcements', '公告管理', '公告管理'),
      icon: Megaphone,
      description: localize(
        locale,
        'Publish notices and manage announcement history.',
        '发布通知和管理历史公告。',
        '發佈通知和管理歷史公告。',
      ),
    },
    {
      key: 'reports',
      title: localize(locale, 'Review queue', '审核队列', '審核隊列'),
      icon: ShieldCheck,
      description: localize(
        locale,
        'Review reports and manage completed records.',
        '审核举报，管理已处理记录。',
        '審核舉報，管理已處理記錄。',
      ),
    },
    ...(isOwner
      ? [
          {
            key: 'feedback',
            title: localize(locale, 'Feedback', '用户反馈', '用戶反饋'),
            icon: MessageSquarePlus,
            description: localize(
              locale,
              'Read, resolve and clean up member feedback.',
              '查看、处理及清理成员反馈。',
              '查看、處理及清理成員反饋。',
            ),
          },
        ]
      : []),
  ];
  return (
    <div className="admin-scroll">
      <Header className="admin-header">
        <Title>{localize(locale, 'Moderation', '管理中心', '管理中心')}</Title>
        <Description>
          {localize(
            locale,
            'Open a workspace to manage records. Actions are checked against your account permissions.',
            '打开独立工作区管理记录，所有操作均校验账号权限。',
            '打開獨立工作區管理記錄，所有操作均校驗帳號權限。',
          )}
        </Description>
      </Header>
      <div className="management-launchers">
        {sections.map((section) => (
          <Dialog
            key={section.key}
            open={active === section.key}
            onOpenChange={(open) => setActive(open ? section.key : null)}
          >
            <DialogTrigger
              render={
                <button
                  className="management-launcher"
                  aria-label={section.title}
                />
              }
            >
              <section.icon />
              <span>
                <strong>{section.title}</strong>
                <small>{section.description}</small>
              </span>
            </DialogTrigger>
            <DialogContent className="management-dialog">
              <DialogHeader>
                <DialogTitle>{section.title}</DialogTitle>
                <DialogDescription>{section.description}</DialogDescription>
              </DialogHeader>
              <div className="management-dialog-scroll">
                {active === section.key &&
                  (section.key === 'announcements' ? (
                    <AnnouncementManager
                      locale={locale}
                      isOwner={isOwner}
                      onChanged={onAnnouncementsChanged}
                    />
                  ) : (
                    <AdminRecords
                      kind={section.key === 'reports' ? 'reports' : 'feedback'}
                      locale={locale}
                      isOwner={isOwner}
                      onPostsChanged={onPostsChanged}
                    />
                  ))}
              </div>
            </DialogContent>
          </Dialog>
        ))}
      </div>
    </div>
  );
}
