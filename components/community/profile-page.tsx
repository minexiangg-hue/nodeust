'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  Bell,
  Bookmark,
  ChevronRight,
  FileText,
  Languages,
  LogOut,
  MessageSquarePlus,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  contactLine,
  roleLabel,
  type ProfileMember,
} from '@/lib/community-model';
import { localize, type Locale } from '@/lib/locale';

function profileFields(profile: ProfileMember | null) {
  return {
    nickname: profile?.nickname ?? '',
    department: profile?.department ?? '',
    programme: profile?.programme ?? '',
    contactMethod: profile?.contactMethod ?? '',
    contactValue: profile?.contactValue ?? '',
  };
}

export function ProfilePage({
  locale,
  profile,
  onSaved,
  onSetLocale,
  onOpenFeedback,
}: {
  locale: Locale;
  profile: ProfileMember | null;
  onSaved: () => void;
  onSetLocale: (next: Locale) => void;
  onOpenFeedback: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [previousProfile, setPreviousProfile] = useState(profile);
  const [form, setForm] = useState(() => profileFields(profile));

  // Reset editable fields when a fresh server profile arrives, before rendering.
  if (profile !== previousProfile) {
    setPreviousProfile(profile);
    if (profile && (!editing || profile.id !== previousProfile?.id)) {
      setForm(profileFields(profile));
      setError('');
    }
  }

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nickname: form.nickname,
          department: form.department,
          programme: form.programme,
          contactMethod: form.contactMethod,
          contactValue: form.contactValue,
          profileVisibility: 'private',
          preferredLanguage: locale,
        }),
      });
      if (!response.ok) throw new Error('save failed');
      setEditing(false);
      onSaved();
    } catch {
      setError(
        localize(
          locale,
          'Could not save. Please try again.',
          '保存失败，请稍后再试。',
          '儲存失敗，請稍後再試。',
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <header className="profile-header">
        <h2>
          {localize(
            locale,
            'Loading profile…',
            '正在读取个人资料…',
            '正在讀取個人資料…',
          )}
        </h2>
      </header>
    );
  }

  const initial = profile.anonymousAlias.trim().charAt(0).toUpperCase() || '?';
  const affiliationLabel =
    profile.affiliation === 'staff'
      ? localize(locale, 'Staff', '教职员', '教職員')
      : profile.affiliation === 'faculty'
        ? localize(locale, 'Faculty', '教员', '教員')
        : localize(locale, 'Student', '学生', '學生');
  const savedContact = contactLine(form.contactMethod, form.contactValue);

  return (
    <>
      <header className="profile-header">
        <div className="profile-avatar">{initial}</div>
        <h2>{profile.anonymousAlias}</h2>
        <p>
          <ShieldCheck />{' '}
          {localize(
            locale,
            'HKUST identity verified',
            'HKUST 身份已验证',
            'HKUST 身份已驗證',
          )}{' '}
          · {roleLabel(profile.role)}
        </p>
      </header>
      <div className="profile-body">
        <nav
          className="profile-quick-links"
          aria-label={localize(
            locale,
            'Personal pages',
            '个人页面',
            '個人頁面',
          )}
        >
          <Link href="/posts">
            <FileText />
            {localize(locale, 'My posts', '我的帖子', '我的帖子')}
            <ChevronRight />
          </Link>
          <Link href="/saved">
            <Bookmark />
            {localize(locale, 'Saved requests', '已收藏', '已收藏')}
            <ChevronRight />
          </Link>
          <Link href="/matches">
            <ArrowLeftRight />
            {localize(locale, 'My matches', '我的匹配', '我的配對')}
            <ChevronRight />
          </Link>
          <Link href="/announcements">
            <Bell />
            {localize(locale, 'Announcements', '公告', '公告')}
            <ChevronRight />
          </Link>
          <Link href="/settings">
            <Settings />
            {localize(locale, 'Settings', '设置', '設定')}
            <ChevronRight />
          </Link>
          {['owner', 'admin', 'moderator'].includes(profile.role) && (
            <Link href="/moderation">
              <ShieldCheck />
              {localize(locale, 'Moderation', '管理中心', '管理中心')}
              <ChevronRight />
            </Link>
          )}
        </nav>
        <div className="privacy-banner">
          <ShieldCheck />
          <div>
            <strong>
              {localize(
                locale,
                'Anonymous by default',
                '默认匿名已开启',
                '預設匿名已開啟',
              )}
            </strong>
            <p>
              {localize(
                locale,
                'Only you can see the private details below; other members only see your anonymous alias.',
                '下面的真实资料仅你自己可见；其他成员只能看到你的匿名昵称。',
                '下面的真實資料僅你自己可見；其他成員只能看到你的匿名暱稱。',
              )}
            </p>
          </div>
        </div>
        {editing ? (
          <div className="profile-form">
            <div className="form-field">
              <label htmlFor="profile-nickname">
                {localize(locale, 'Nickname', '昵称', '暱稱')}
              </label>
              <Input
                id="profile-nickname"
                value={form.nickname}
                onChange={(event) =>
                  setForm({ ...form, nickname: event.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor="profile-department">
                {localize(locale, 'Department', '院系', '院系')}
              </label>
              <Input
                id="profile-department"
                value={form.department}
                onChange={(event) =>
                  setForm({ ...form, department: event.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor="profile-programme">
                {localize(
                  locale,
                  'Programme / year',
                  '课程／年级',
                  '課程／年級',
                )}
              </label>
              <Input
                id="profile-programme"
                value={form.programme}
                onChange={(event) =>
                  setForm({ ...form, programme: event.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor="profile-contact-method">
                {localize(
                  locale,
                  'Contact method',
                  '联系方式平台',
                  '聯絡方式平台',
                )}
              </label>
              <Input
                id="profile-contact-method"
                placeholder={localize(
                  locale,
                  'Telegram · WhatsApp · 邮箱',
                  'Telegram · WhatsApp · 邮箱',
                  'Telegram · WhatsApp · 郵箱',
                )}
                value={form.contactMethod}
                onChange={(event) =>
                  setForm({ ...form, contactMethod: event.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor="profile-contact">
                {localize(
                  locale,
                  'Contact handle / number',
                  '账号或号码',
                  '帳號或號碼',
                )}
              </label>
              <Input
                id="profile-contact"
                value={form.contactValue}
                onChange={(event) =>
                  setForm({ ...form, contactValue: event.target.value })
                }
              />
              <small className="field-hint">
                {localize(
                  locale,
                  'Only revealed to the other side after a mutual exchange.',
                  '只有在双方同意交换后才会向对方展示。',
                  '只有在雙方同意交換後才會向對方展示。',
                )}
              </small>
            </div>
            {error && <span className="consent-error">{error}</span>}
            <div className="profile-form-actions">
              <Button onClick={() => void save()} disabled={saving}>
                {saving
                  ? localize(locale, 'Saving…', '保存中…', '儲存中…')
                  : localize(
                      locale,
                      'Save profile',
                      '保存个人资料',
                      '儲存個人資料',
                    )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setForm(profileFields(profile));
                  setError('');
                }}
              >
                {localize(locale, 'Cancel', '取消', '取消')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <dl>
              <div>
                <dt>
                  {localize(
                    locale,
                    'Public anonymous alias',
                    '公开匿名昵称',
                    '公開匿名暱稱',
                  )}
                </dt>
                <dd>{profile.anonymousAlias}</dd>
              </div>
              <div>
                <dt>{localize(locale, 'Nickname', '昵称', '暱稱')}</dt>
                <dd>{form.nickname || '—'}</dd>
              </div>
              <div>
                <dt>{localize(locale, 'Real name', '真实姓名', '真實姓名')}</dt>
                <dd>{profile.fullName}</dd>
              </div>
              <div>
                <dt>
                  {localize(locale, 'ITSO email', 'ITSO 邮箱', 'ITSO 電郵')}
                </dt>
                <dd>{profile.email}</dd>
              </div>
              <div>
                <dt>{localize(locale, 'Affiliation', '身份', '身份')}</dt>
                <dd>
                  {affiliationLabel} · {roleLabel(profile.role)}
                </dd>
              </div>
              <div>
                <dt>
                  {localize(
                    locale,
                    'Department / programme',
                    '院系／课程',
                    '院系／課程',
                  )}
                </dt>
                <dd>
                  {[form.department, form.programme]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </dd>
              </div>
              <div>
                <dt>
                  {localize(
                    locale,
                    'Contact (after mutual consent)',
                    '联系方式（双向同意后）',
                    '聯絡方式（雙向同意後）',
                  )}
                </dt>
                <dd>{savedContact || '—'}</dd>
              </div>
            </dl>
            <Button variant="outline" onClick={() => setEditing(true)}>
              {localize(locale, 'Edit profile', '编辑个人资料', '編輯個人資料')}
            </Button>
          </>
        )}
        <div className="profile-tools">
          <div className="profile-tool profile-tool-row">
            <span className="profile-tool-icon">
              <Languages />
            </span>
            <div className="profile-lang">
              <span className="profile-lang-label">
                {localize(locale, 'Interface language', '界面语言', '介面語言')}
              </span>
              <div className="profile-lang-options">
                {(['en', 'zh-CN', 'zh-HK'] as const).map((code) => (
                  <button
                    key={code}
                    className={locale === code ? 'active' : ''}
                    onClick={() => onSetLocale(code)}
                  >
                    {code === 'en'
                      ? 'English'
                      : code === 'zh-CN'
                        ? '简体中文'
                        : '繁體中文'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="profile-tool profile-tool-row profile-tool-btn"
            onClick={onOpenFeedback}
          >
            <MessageSquarePlus />
            {localize(
              locale,
              'Send feedback',
              '意见箱 · 发送反馈',
              '意見箱 · 傳送反饋',
            )}
          </button>
        </div>
        <Link href="/rules">
          {localize(
            locale,
            'Community rules and privacy',
            '社区规则与隐私说明',
            '社群規則與私隱說明',
          )}
        </Link>
        <Button
          variant="destructive"
          className="profile-signout"
          onClick={() => {
            window.location.href = '/__gateway/logout';
          }}
        >
          <LogOut />
          {localize(locale, 'Sign out', '退出登录', '登出')}
        </Button>
      </div>
    </>
  );
}
