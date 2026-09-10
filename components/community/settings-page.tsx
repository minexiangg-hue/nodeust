'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Compass,
  EyeOff,
  Languages,
  List,
  LoaderCircle,
  LogOut,
  MapPin,
  MessageSquare,
  Monitor,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';

import {
  campusLocations,
  getCampusLocationLabel,
  getLocationGroupLabel,
  locationGroups,
} from '@/lib/campus-locations';
import { localize, type Locale } from '@/lib/locale';

export type SettingsPageProps = {
  locale: Locale;
  onLocaleChange: (locale: Locale) => Promise<boolean>;
  showBubbles: boolean;
  onShowBubblesChange: (value: boolean) => void;
  defaultView: 'plaza' | 'list';
  onDefaultViewChange: (value: 'plaza' | 'list') => void;
  currentLocationId: string;
  onLocationChange: (value: string) => Promise<boolean>;
  locationSaving: boolean;
  onFeedback: () => void;
};

export function SettingsPage({
  locale,
  onLocaleChange,
  showBubbles,
  onShowBubblesChange,
  defaultView,
  onDefaultViewChange,
  currentLocationId,
  onLocationChange,
  locationSaving,
  onFeedback,
}: SettingsPageProps) {
  const t = (en: string, cn: string, hk: string) =>
    localize(locale, en, cn, hk);
  const controlId = useId();
  const [languageSaving, setLanguageSaving] = useState(false);
  const [locationPending, setLocationPending] = useState(false);
  const [languageResult, setLanguageResult] = useState<
    'saved' | 'error' | null
  >(null);
  const [locationResult, setLocationResult] = useState<
    'saved' | 'error' | null
  >(null);
  const [preferenceError, setPreferenceError] = useState(false);

  async function changeLanguage(value: string) {
    if (value !== 'en' && value !== 'zh-CN' && value !== 'zh-HK') return;
    setLanguageSaving(true);
    setLanguageResult(null);
    try {
      setLanguageResult((await onLocaleChange(value)) ? 'saved' : 'error');
    } catch {
      setLanguageResult('error');
    } finally {
      setLanguageSaving(false);
    }
  }

  async function changeLocation(value: string) {
    setLocationPending(true);
    setLocationResult(null);
    try {
      setLocationResult((await onLocationChange(value)) ? 'saved' : 'error');
    } catch {
      setLocationResult('error');
    } finally {
      setLocationPending(false);
    }
  }

  function changePreference(save: () => void) {
    setPreferenceError(false);
    try {
      save();
    } catch {
      setPreferenceError(true);
    }
  }

  return (
    <div className="settings-page">
      <header className="settings-page-header">
        <p className="settings-eyebrow">
          <SlidersHorizontal aria-hidden="true" />
          {t(
            'MAKE YOURSELF AT HOME',
            '按你的习惯，安排日常',
            '按你的習慣，安排日常',
          )}
        </p>
        <h1>{t('Settings', '设置', '設定')}</h1>
        <p>
          {t(
            'A few small choices to make NODE feel more like you.',
            '调整语言、探索方式和地点，让 NODE 更合你的习惯。',
            '調整語言、探索方式和地點，讓 NODE 更合你的習慣。',
          )}
        </p>
      </header>

      <div className="settings-layout">
        <div className="settings-main">
          <section
            className="settings-section"
            aria-labelledby={`${controlId}-account`}
          >
            <div className="settings-section-heading">
              <UserRound aria-hidden="true" />
              <div>
                <h2 id={`${controlId}-account`}>
                  {t('Your account', '账号偏好', '帳戶偏好')}
                </h2>
                <p>
                  {t(
                    'These choices follow your account.',
                    '这些设置会保存在你的账号中。',
                    '這些設定會儲存在你的帳戶中。',
                  )}
                </p>
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row-copy">
                <label htmlFor={`${controlId}-language`}>
                  <Languages aria-hidden="true" />
                  {t('Language', '语言', '語言')}
                </label>
                <p id={`${controlId}-language-help`}>
                  {t(
                    'Choose the language you feel at home in.',
                    '选择你熟悉的界面语言。',
                    '選擇你熟悉的介面語言。',
                  )}
                </p>
              </div>
              <div className="settings-control">
                <select
                  id={`${controlId}-language`}
                  aria-describedby={`${controlId}-language-help`}
                  value={locale}
                  disabled={languageSaving}
                  onChange={(event) => void changeLanguage(event.target.value)}
                >
                  <option value="en">English</option>
                  <option value="zh-CN">简体中文</option>
                  <option value="zh-HK">繁體中文</option>
                </select>
                <output className="settings-save-status" aria-live="polite">
                  {languageSaving && (
                    <>
                      <LoaderCircle
                        className="settings-spinner"
                        aria-hidden="true"
                      />
                      {t('Saving…', '保存中…', '儲存中…')}
                    </>
                  )}
                  {!languageSaving && languageResult === 'saved' && (
                    <>
                      <Check aria-hidden="true" />
                      {t('Saved', '已保存', '已儲存')}
                    </>
                  )}
                </output>
                {languageResult === 'error' && (
                  <p className="settings-error" role="alert">
                    {t(
                      'Could not save. Please try again.',
                      '保存失败，请重试。',
                      '儲存失敗，請重試。',
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row-copy">
                <label htmlFor={`${controlId}-location`}>
                  <MapPin aria-hidden="true" />
                  {t('Campus location', '校园地点', '校園地點')}
                </label>
                <p id={`${controlId}-location-help`}>
                  {t(
                    'Your location tag on the plaza. Choose it yourself; NODE does not track your live location.',
                    '你在广场上的地点标签，由你手动选择。NODE 不追踪你的实时位置。',
                    '你在廣場上的地點標籤，由你手動選擇。NODE 不追蹤你的即時位置。',
                  )}
                </p>
              </div>
              <div className="settings-control">
                <select
                  id={`${controlId}-location`}
                  aria-describedby={`${controlId}-location-help`}
                  value={currentLocationId}
                  disabled={locationSaving || locationPending}
                  onChange={(event) => void changeLocation(event.target.value)}
                >
                  {!campusLocations.some(
                    (location) => location.id === currentLocationId,
                  ) && (
                    <option value={currentLocationId} disabled>
                      {t('Choose a location', '选择地点', '選擇地點')}
                    </option>
                  )}
                  {locationGroups.map((group) => (
                    <optgroup
                      key={group.id}
                      label={getLocationGroupLabel(group, locale)}
                    >
                      {campusLocations
                        .filter((location) => location.group === group.id)
                        .map((location) => (
                          <option key={location.id} value={location.id}>
                            {getCampusLocationLabel(location, locale)}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                <output className="settings-save-status" aria-live="polite">
                  {(locationSaving || locationPending) && (
                    <>
                      <LoaderCircle
                        className="settings-spinner"
                        aria-hidden="true"
                      />
                      {t('Saving…', '保存中…', '儲存中…')}
                    </>
                  )}
                  {!locationSaving &&
                    !locationPending &&
                    locationResult === 'saved' && (
                      <>
                        <Check aria-hidden="true" />
                        {t('Saved', '已保存', '已儲存')}
                      </>
                    )}
                </output>
                {locationResult === 'error' && (
                  <p className="settings-error" role="alert">
                    {t(
                      'Could not change your location. Please try again.',
                      '地点更新失败，请重试。',
                      '地點更新失敗，請重試。',
                    )}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section
            className="settings-section"
            aria-labelledby={`${controlId}-explore`}
          >
            <div className="settings-section-heading">
              <Monitor aria-hidden="true" />
              <div>
                <h2 id={`${controlId}-explore`}>
                  {t('Your way to explore', '探索偏好', '探索偏好')}
                </h2>
                <p>
                  {t(
                    'Saved in this browser on this device.',
                    '仅保存在当前设备的浏览器中。',
                    '僅儲存在目前裝置的瀏覽器中。',
                  )}
                </p>
              </div>
            </div>

            <fieldset className="settings-row settings-view-fieldset">
              <legend className="settings-row-copy">
                <span className="settings-setting-title">
                  {t('Default plaza view', '广场默认视图', '廣場預設視圖')}
                </span>
                <span className="settings-setting-help">
                  {t(
                    'The view you start with when opening NODE. You can switch anytime on the plaza.',
                    '每次打开 NODE 时使用的视图。也可以随时在广场中切换。',
                    '每次開啟 NODE 時使用的視圖。也可以隨時在廣場中切換。',
                  )}
                </span>
              </legend>
              <div className="settings-view-options">
                <label
                  className={`settings-view-option${defaultView === 'plaza' ? ' is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name={`${controlId}-view`}
                    value="plaza"
                    checked={defaultView === 'plaza'}
                    onChange={() =>
                      changePreference(() => onDefaultViewChange('plaza'))
                    }
                  />
                  <Compass aria-hidden="true" />
                  <span>{t('Map', '地图', '地圖')}</span>
                  {defaultView === 'plaza' && (
                    <Check className="settings-view-check" aria-hidden="true" />
                  )}
                </label>
                <label
                  className={`settings-view-option${defaultView === 'list' ? ' is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name={`${controlId}-view`}
                    value="list"
                    checked={defaultView === 'list'}
                    onChange={() =>
                      changePreference(() => onDefaultViewChange('list'))
                    }
                  />
                  <List aria-hidden="true" />
                  <span>{t('List', '列表', '列表')}</span>
                  {defaultView === 'list' && (
                    <Check className="settings-view-check" aria-hidden="true" />
                  )}
                </label>
              </div>
            </fieldset>

            <div className="settings-row settings-toggle-row">
              <div className="settings-row-copy">
                <label htmlFor={`${controlId}-bubbles`}>
                  {t(
                    'Request previews on the map',
                    '在地图上预览需求',
                    '在地圖上預覽需求',
                  )}
                </label>
                <p id={`${controlId}-bubbles-help`}>
                  {t(
                    'Show request bubbles beside campus locations.',
                    '在校园地点旁显示需求气泡。',
                    '在校園地點旁顯示需求氣泡。',
                  )}
                </p>
              </div>
              <label
                className="settings-switch"
                aria-label={t(
                  'Request previews on the map',
                  '在地图上预览需求',
                  '在地圖上預覽需求',
                )}
              >
                <input
                  id={`${controlId}-bubbles`}
                  type="checkbox"
                  role="switch"
                  checked={showBubbles}
                  aria-checked={showBubbles}
                  aria-describedby={`${controlId}-bubbles-help`}
                  onChange={(event) =>
                    changePreference(() =>
                      onShowBubblesChange(event.target.checked),
                    )
                  }
                />
                <span className="settings-switch-track" aria-hidden="true">
                  <span />
                </span>
              </label>
            </div>
            {preferenceError && (
              <p
                className="settings-error settings-preference-error"
                role="alert"
              >
                {t(
                  'This browser could not save your preference. Please try again.',
                  '当前浏览器无法保存偏好，请重试。',
                  '目前瀏覽器無法儲存偏好，請重試。',
                )}
              </p>
            )}
          </section>

          <section
            className="settings-section"
            aria-labelledby={`${controlId}-support`}
          >
            <div className="settings-section-heading">
              <MessageSquare aria-hidden="true" />
              <div>
                <h2 id={`${controlId}-support`}>
                  {t('Community & support', '社群与支持', '社群與支援')}
                </h2>
                <p>
                  {t(
                    'Help make this a good place to connect.',
                    '一起让这里成为更好的相遇之地。',
                    '一起讓這裏成為更好的相遇之地。',
                  )}
                </p>
              </div>
            </div>
            <div className="settings-link-list">
              <Link href="/rules">
                <ShieldCheck aria-hidden="true" />
                <span>{t('Community rules', '社群规则', '社群規則')}</span>
                <ArrowUpRight aria-hidden="true" />
              </Link>
              <button type="button" onClick={onFeedback}>
                <MessageSquare aria-hidden="true" />
                <span>
                  {t(
                    'Share feedback or report a problem',
                    '提供建议或反馈问题',
                    '提供建議或回報問題',
                  )}
                </span>
                <ArrowUpRight aria-hidden="true" />
              </button>
              <Link
                className="settings-signout"
                href="/__gateway/logout"
                prefetch={false}
                target="_top"
              >
                <LogOut aria-hidden="true" />
                <span>{t('Sign out', '退出登录', '登出')}</span>
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </div>
          </section>
        </div>

        <aside className="settings-aside">
          <div className="settings-privacy-card">
            <span className="settings-privacy-icon">
              <EyeOff aria-hidden="true" />
            </span>
            <p className="settings-aside-kicker">
              {t('PRIVATE BY DEFAULT', '默认保护隐私', '預設保護私隱')}
            </p>
            <h2>
              {t(
                'You choose when to share.',
                '由你决定，何时分享。',
                '由你決定，何時分享。',
              )}
            </h2>
            <p>
              {t(
                'Your public identity is an alias. Contact details are shared in a conversation only after both people agree.',
                '在社群中，你以匿名身份展示。只有双方同意后，联系方式才会在对话中互相公开。',
                '在社群中，你以匿名身份展示。只有雙方同意後，聯絡方式才會在對話中互相公開。',
              )}
            </p>
            <div className="settings-privacy-divider" />
            <p>
              {t(
                'Manage your profile and contact details in one place.',
                '在个人资料中统一管理你的信息与联系方式。',
                '在個人資料中統一管理你的資訊與聯絡方式。',
              )}
            </p>
            <Link href="/profile">
              {t('Go to your profile', '管理个人资料', '管理個人資料')}
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
          <p className="settings-project-note">
            {t(
              'NODE is an independent community project. It is not an official HKUST service.',
              'NODE 是独立社群项目，并非香港科技大学官方服务。',
              'NODE 是獨立社群項目，並非香港科技大學官方服務。',
            )}
          </p>
        </aside>
      </div>
    </div>
  );
}
