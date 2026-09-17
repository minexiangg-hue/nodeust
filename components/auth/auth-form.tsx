'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Mail, ShieldCheck } from 'lucide-react';
export type AuthMode =
  | 'login'
  | 'register'
  | 'verify'
  | 'forgot-password'
  | 'reset-password'
  | 'logout';
const titles: Record<AuthMode, [string, string]> = {
  login: ['Welcome back.', '登录你的校园社区'],
  register: ['Find your people.', '使用科大邮箱注册'],
  verify: ['One last step.', '验证你的邮箱'],
  'forgot-password': ['Let’s get you back in.', '找回密码'],
  'reset-password': ['A fresh start.', '设置新密码'],
  logout: ['See you around.', '退出登录'],
};
const errors: Record<string, string> = {
  INVALID_EMAIL:
    'Use a university email or the designated administrator email. 请使用科大邮箱或指定的管理员邮箱。',
  INVALID_PASSWORD:
    'Use 12–128 characters for your password. 密码需为 12–128 个字符。',
  LOGIN_FAILED:
    'Email or password is incorrect, or your email has not been verified. 邮箱或密码有误，或邮箱尚未验证。',
  INVALID_LINK:
    'This link is invalid, expired, already used, or the registration password is incorrect. 链接无效、已过期、已使用，或注册密码不正确。',
  RATE_LIMITED:
    'Too many attempts. Please try again later. 操作过于频繁，请稍后重试。',
  MAIL_UNAVAILABLE:
    'Email delivery is temporarily unavailable. Please try again later. 邮件暂时无法发送，请稍后重试。',
  BUSY: 'Please try again in a moment. 请稍后重试。',
};
export function AuthForm({
  mode,
  next = '/explore',
}: {
  mode: AuthMode;
  next?: string;
}) {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('');
  const [token, setToken] = useState(''),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      setToken(hash.get('token') || '');
      if (hash.has('token'))
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search,
        );
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  const hasEmail = ['login', 'register', 'forgot-password'].includes(mode);
  const hasPassword = [
    'login',
    'register',
    'verify',
    'reset-password',
  ].includes(mode);
  const needsToken = mode === 'verify' || mode === 'reset-password';
  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (
      (mode === 'register' || mode === 'reset-password') &&
      password !== confirm
    ) {
      setError('Passwords do not match. 两次密码不一致。');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, token, next }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          errors[data.error] ||
            'Unable to complete this request. Please try again. 暂时无法完成，请重试。',
        );
      if (mode === 'login') {
        window.location.assign(data.next || '/explore');
        return;
      }
      if (mode === 'logout') {
        window.location.assign('/login');
        return;
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again. 请重试。');
    } finally {
      setBusy(false);
    }
  }
  const finished = done && (mode === 'verify' || mode === 'reset-password');
  return (
    <div className="email-auth-page">
      <header className="email-auth-header">
        <Link className="brand" href="/">
          NODE
          <span className="email-auth-brand-dot" />
        </Link>
        <Link href="/rules">Community rules · 社群规则</Link>
      </header>
      <main className="email-auth-main">
        <aside className="email-auth-story">
          <p className="email-auth-eyebrow">YOUR CAMPUS. YOUR COMMUNITY.</p>
          <h1>
            A familiar place.
            <br />
            <span>New connections.</span>
          </h1>
          <p>Share a little. Find a study partner. Make campus feel closer.</p>
          <p>从一件小事开始，找到校园里的连接。</p>
          <div className="email-auth-assurance">
            <ShieldCheck size={20} />
            <span>
              Verified email.
              <br />
              Anonymous community conversations.
            </span>
          </div>
        </aside>
        <section className="email-auth-card" aria-labelledby="auth-title">
          <div className="email-auth-icon">
            <Mail size={23} />
          </div>
          <h2 id="auth-title">{titles[mode][0]}</h2>
          <p className="email-auth-subtitle">{titles[mode][1]}</p>
          {(mode === 'register' || mode === 'login') && (
            <p className="email-auth-hint">
              Use your <strong>@connect.ust.hk</strong> or{' '}
              <strong>@ust.hk</strong> email. This is an independent NODE
              account, not university SSO. The designated administrator email is the only exception. 指定管理员邮箱可例外注册。
              <br />
              新系统需重新注册；不会关联旧内测账号或数据。
            </p>
          )}
          {mode === 'verify' && (
            <p className="email-auth-hint">
              Enter the password you chose when registering to activate your
              account. 请输入注册时设置的密码完成验证。链接 24 小时有效。
            </p>
          )}
          {mode === 'forgot-password' && (
            <p className="email-auth-hint">
              We’ll email you a link if an eligible account exists.
              如该邮箱存在已验证账号，我们将发送重设链接。
            </p>
          )}
          {mode === 'reset-password' && (
            <p className="email-auth-hint">
              Choose a new password. All existing sessions will be signed out.
              设置新密码后，所有设备上的旧登录会失效。
            </p>
          )}
          {mode === 'logout' && (
            <p className="email-auth-hint">
              Your posts and conversations will stay here.
              退出不会删除帖子和聊天。
            </p>
          )}
          {error && (
            <p className="email-auth-alert" role="alert">
              {error}
            </p>
          )}
          {done && (
            <output className="email-auth-success">
              <CheckCircle2 size={20} />
              <span>
                {finished
                  ? 'All done. You can now sign in. 已完成，请使用邮箱和密码登录。'
                  : 'If this address is eligible, a link has been sent. Check your inbox and junk folder. 请查看邮箱及垃圾邮件，使用最近收到的链接。'}
              </span>
            </output>
          )}
          {needsToken && ready && !token && !finished ? (
            <p className="email-auth-alert">
              Open the complete link from your email. 请从邮件打开完整链接。
              <Link href={mode === 'verify' ? '/register' : '/forgot-password'}>
                {' '}
                Request a new link · 重新申请
              </Link>
            </p>
          ) : (
            !finished && (
              <form onSubmit={submit}>
                {hasEmail && (
                  <label>
                    Email · 邮箱
                    <input
                      type="email"
                      name="email"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      maxLength={191}
                      placeholder="you@connect.ust.hk"
                    />
                  </label>
                )}
                {hasPassword && (
                  <label>
                    {mode === 'reset-password'
                      ? 'New password · 新密码'
                      : 'Password · 密码'}
                    <input
                      type="password"
                      name="password"
                      autoComplete={
                        mode === 'register' || mode === 'reset-password'
                          ? 'new-password'
                          : 'current-password'
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={12}
                      maxLength={128}
                    />
                  </label>
                )}
                {(mode === 'register' || mode === 'reset-password') && (
                  <>
                    <p className="email-auth-hint">
                      12–128 characters · 可使用长密码短语，不要求固定字符组合。
                    </p>
                    <label>
                      Confirm password · 确认密码
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        minLength={12}
                        maxLength={128}
                      />
                    </label>
                  </>
                )}
                <button
                  className="email-auth-submit"
                  type="submit"
                  disabled={busy || (needsToken && !ready)}
                >
                  {busy
                    ? 'Please wait · 请稍候'
                    : mode === 'login'
                      ? 'Sign in · 登录'
                      : mode === 'register'
                        ? done
                          ? 'Resend link · 重发链接'
                          : 'Create account · 注册'
                        : mode === 'verify'
                          ? 'Verify email · 验证邮箱'
                          : mode === 'logout'
                            ? 'Sign out · 退出登录'
                            : mode === 'reset-password'
                              ? 'Save password · 保存密码'
                              : 'Send reset link · 发送重设链接'}
                  <ArrowRight size={18} />
                </button>
              </form>
            )
          )}
          <nav className="email-auth-links">
            {mode === 'login' ? (
              <>
                <Link href="/register">Create an account · 注册</Link>
                <Link href="/forgot-password">Forgot password? · 忘记密码</Link>
              </>
            ) : (
              <Link href="/login">Back to sign in · 返回登录</Link>
            )}
          </nav>
        </section>
      </main>
      <footer className="email-auth-footer">
        Independent HKUST community · NODE 校园社区
      </footer>
    </div>
  );
}
