'use client';

import Link from 'next/link';
import {
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Sparkles,
  Compass,
  EyeOff,
  Plus,
  Settings2,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import { localize, type Locale } from '@/lib/locale';

export type HomePageProps = {
  locale: Locale;
  alias?: string;
  signedIn?: boolean;
  unreadAnnouncements?: boolean;
  matchCount?: number;
  matchingDisabled?: boolean;
};

export function HomePage({
  locale,
  alias,
  signedIn = true,
  unreadAnnouncements = false,
  matchCount,
  matchingDisabled = false,
}: HomePageProps) {
  const t = (en: string, cn: string, hk: string) =>
    localize(locale, en, cn, hk);

  return (
    <div className="community-home">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <p className="home-eyebrow">
            <span />
            {t(
              'YOUR CAMPUS. YOUR COMMUNITY.',
              '在科大，连接彼此。',
              '在科大，連繫彼此。',
            )}
          </p>
          <h1 id="home-title">
            {t('A little closer.', '让彼此更近，', '讓彼此更近，')}
            <span>
              {t(
                'A lot more possible.',
                '让日常有更多可能。',
                '讓日常有更多可能。',
              )}
            </span>
          </h1>
          <p className="home-introduction">
            {t(
              'Something to share, a place to call home, or a question to work through. Find your connection at HKUST.',
              '一件想交换的物品，一处向往的宿舍，一个想一起解答的问题。从身边的需求开始，遇见校园里的彼此。',
              '一件想交換的物品，一處嚮往的宿舍，一個想一起解答的問題。從身邊的需求開始，遇見校園裏的彼此。',
            )}
          </p>
          <div className="home-actions">
            <Link
              className="home-button home-button-primary"
              href={signedIn ? '/explore' : '/__gateway/login?next=/explore'}
              prefetch={signedIn ? undefined : false}
              target={signedIn ? undefined : '_top'}
            >
              <Compass aria-hidden="true" />
              {signedIn
                ? t('Explore the plaza', '进入探索广场', '進入探索廣場')
                : t('Join your community', '登录并开始探索', '登入並開始探索')}
              <ArrowRight aria-hidden="true" />
            </Link>
            {signedIn && (
              <Link
                className="home-button home-button-secondary"
                href="/posts/new"
              >
                <Plus aria-hidden="true" />
                {t('Share a request', '发布需求', '發佈需求')}
              </Link>
            )}
          </div>
          <p className="home-privacy-note">
            <EyeOff aria-hidden="true" />
            {t(
              'Start with an alias. Connect at your own pace.',
              '以匿名身份出发，按自己的节奏建立联系。',
              '以匿名身份出發，按自己的節奏建立聯繫。',
            )}
          </p>
        </div>

        <div className="home-campus-art" aria-hidden="true">
          <div className="home-art-caption">
            <span>NODE / HKUST</span>
            <span>
              {t(
                'A CAMPUS OF CONNECTIONS',
                '校园中的每一次相遇',
                '校園中的每一次相遇',
              )}
            </span>
          </div>
          <svg
            className="home-campus-diagram"
            viewBox="0 0 440 400"
            fill="none"
          >
            <defs>
              <pattern
                id="home-campus-grid"
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <circle
                  cx="1"
                  cy="1"
                  r="0.75"
                  fill="currentColor"
                  opacity="0.2"
                />
              </pattern>
            </defs>
            <rect
              x="0"
              y="0"
              width="440"
              height="400"
              fill="url(#home-campus-grid)"
            />
            <path
              className="home-contour"
              d="M28 300C90 295 55 189 118 165S156 80 210 82S270 120 335 80S430 92 449 55M6 330C83 338 80 221 138 196S178 114 221 115S291 145 353 113S427 114 462 88M-5 361C87 380 111 252 153 233S186 149 234 150S310 180 370 148S450 153 469 132"
            />
            <path
              className="home-connection-line"
              d="M90 110L214 190L342 127M214 190L125 305M214 190L343 292M90 110L125 305"
            />
            <path
              className="home-connection-highlight"
              d="M90 110L214 190L343 292"
            />
            <circle cx="214" cy="190" r="74" className="home-orbit" />
            <circle
              cx="214"
              cy="190"
              r="103"
              className="home-orbit home-orbit-outer"
            />
            <circle cx="90" cy="110" r="25" className="home-art-node" />
            <path
              d="M79 118V104L90 97L101 104V118H94V109H86V118H79Z"
              className="home-node-symbol"
            />
            <circle cx="342" cy="127" r="21" className="home-art-node" />
            <path
              d="M334 120H350M347 117L350 120L347 123M350 134H334M337 131L334 134L337 137"
              className="home-node-symbol"
            />
            <circle cx="125" cy="305" r="24" className="home-art-node" />
            <path
              d="M114 296C118 295 122 296 125 298C128 296 132 295 136 296V312C132 311 128 312 125 314C122 312 118 311 114 312V296ZM125 298V314"
              className="home-node-symbol"
            />
            <circle cx="343" cy="292" r="25" className="home-art-node" />
            <path
              d="M332 283H354V298H344L338 303V298H332V283Z"
              className="home-node-symbol"
            />
            <circle cx="214" cy="190" r="34" className="home-art-center" />
            <circle cx="214" cy="190" r="6" fill="#15251d" />
            <ellipse
              cx="214"
              cy="190"
              rx="21"
              ry="10"
              transform="rotate(-35 214 190)"
              className="home-center-orbit"
            />
            <ellipse
              cx="214"
              cy="190"
              rx="21"
              ry="10"
              transform="rotate(35 214 190)"
              className="home-center-orbit"
            />
            <circle cx="152" cy="150" r="3.5" className="home-line-dot" />
            <circle cx="279" cy="242" r="3.5" className="home-line-dot" />
            <circle
              cx="292"
              cy="152"
              r="3"
              className="home-line-dot home-line-dot-muted"
            />
          </svg>
          <div className="home-art-footer">
            <span className="home-art-rule" />
            {t(
              'Small needs. Meaningful connections.',
              '从小小需求，到真实联系。',
              '從小小需求，到真實聯繫。',
            )}
          </div>
        </div>
      </section>

      <section
        className="home-possibilities"
        aria-labelledby="home-possibilities-title"
      >
        <div className="home-section-heading">
          <h2 id="home-possibilities-title">
            {t(
              'Everyday life, a little easier.',
              '让校园日常，轻松一点。',
              '讓校園日常，輕鬆一點。',
            )}
          </h2>
          <span>
            {t('MADE FOR LIFE AT HKUST', '为科大生活而生', '為科大生活而生')}
          </span>
        </div>
        <div className="home-feature-grid">
          <article className="home-feature">
            <span className="home-feature-icon">
              <ArrowDownUp aria-hidden="true" />
            </span>
            <div>
              <h3>
                {t(
                  'Give things a next chapter',
                  '让好物继续发光',
                  '讓好物繼續發光',
                )}
              </h3>
              <p>
                {t(
                  'Exchange the things you have for the things you need.',
                  '交换闲置，找到所需。让一件物品遇见下一位主人。',
                  '交換閒置，找到所需。讓一件物品遇見下一位主人。',
                )}
              </p>
            </div>
          </article>
          <article className="home-feature">
            <span className="home-feature-icon home-feature-icon-clay">
              <Sparkles aria-hidden="true" />
            </span>
            <div>
              <h3>
                <Link
                  href={
                    signedIn ? '/matches' : '/__gateway/login?next=/matches'
                  }
                  prefetch={signedIn ? undefined : false}
                >
                  {matchingDisabled
                    ? t(
                        'Matching is temporarily paused',
                        '匹配暂时暂停',
                        '配對暫時暫停',
                      )
                    : t(
                        'Find complementary requests',
                        '寻找互补需求',
                        '尋找互補需求',
                      )}
                  {signedIn && matchCount !== undefined && matchCount > 0 && (
                    <span className="home-match-count">{matchCount}</span>
                  )}
                </Link>
              </h3>
              <p>
                {t(
                  'Housing, items, study, transport and activities. Connect through the details in your requests.',
                  '宿舍、物品、学习、交通和活动，从具体的需求找到彼此。',
                  '宿舍、物品、學習、交通和活動，從具體的需求找到彼此。',
                )}
              </p>
            </div>
          </article>
          <article className="home-feature">
            <span className="home-feature-icon home-feature-icon-blue">
              <BookOpen aria-hidden="true" />
            </span>
            <div>
              <h3>
                {t('Figure it out together', '一起找到答案', '一起找到答案')}
              </h3>
              <p>
                {t(
                  'Find a study partner, share a skill, or ask for a hand.',
                  '找个学习搭子，分享一项技能，或向身边的人寻求帮助。',
                  '找個學習夥伴，分享一項技能，或向身邊的人尋求幫助。',
                )}
              </p>
            </div>
          </article>
        </div>
      </section>

      <section
        className="home-community-links"
        aria-label={t('Community information', '社群信息', '社群資訊')}
      >
        <Link className="home-resource" href="/announcements">
          <Bell aria-hidden="true" />
          <span>
            <strong>
              {t('Community updates', '社群公告', '社群公告')}
              {unreadAnnouncements && (
                <span
                  className="home-unread-dot"
                  aria-label={t(
                    'Unread announcements',
                    '有未读公告',
                    '有未讀公告',
                  )}
                />
              )}
            </strong>
            <small>
              {t(
                'The latest from NODE',
                '看看 NODE 最近有什么新消息',
                '看看 NODE 最近有甚麼新消息',
              )}
            </small>
          </span>
          <ArrowUpRight aria-hidden="true" />
        </Link>
        <Link className="home-resource" href="/rules">
          <ShieldCheck aria-hidden="true" />
          <span>
            <strong>
              {t(
                'A community we care for',
                '共同守护这片社群',
                '共同守護這片社群',
              )}
            </strong>
            <small>
              {t(
                'Read our community guidelines',
                '了解社群规则与隐私约定',
                '了解社群規則與私隱約定',
              )}
            </small>
          </span>
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </section>

      <footer className="home-footer">
        <span>
          {signedIn && alias
            ? t(
                `Welcome back, ${alias}.`,
                `欢迎回来，${alias}。`,
                `歡迎回來，${alias}。`,
              )
            : t(
                'An independent community project for HKUST.',
                '一个为科大而建的独立社群项目。',
                '一個為科大而建的獨立社群項目。',
              )}
        </span>
        {signedIn && (
          <nav aria-label={t('Your account', '你的账号', '你的帳戶')}>
            <Link href="/profile">
              <UserRound aria-hidden="true" />
              {t('Your profile', '个人资料', '個人資料')}
            </Link>
            <Link href="/settings">
              <Settings2 aria-hidden="true" />
              {t('Settings', '设置', '設定')}
            </Link>
          </nav>
        )}
      </footer>
    </div>
  );
}
