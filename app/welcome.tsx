import Link from 'next/link';
import { ArrowRight, EyeOff, Network, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function Welcome() {
  return (
    <main className="welcome-page">
      <header className="welcome-header">
        <div className="brand">
          <span className="brand-mark">
            <span />
          </span>
          <span>NODE</span>
          <span className="welcome-beta">HKUST COMMUNITY</span>
        </div>
        <Link href="/rules">社区规则</Link>
      </header>
      <section className="welcome-main">
        <div className="welcome-copy">
          <div className="rules-kicker">
            <span className="pulse-dot" /> VERIFIED COMMUNITY · ANONYMOUS BY
            DEFAULT
          </div>
          <h1>
            找到那个刚好
            <br />
            需要彼此的人。
          </h1>
          <p>
            面向 HKUST
            学生与教职员工的匿名交换广场。看见需求、寻找双向匹配，在双方同意之前保持匿名。
          </p>
          <Button
            render={
              <Link
                href="/auth/hkust"
                prefetch={false}
                target="_top"
                aria-label="使用 HKUST ITSO 登录"
              >
                <ShieldCheck /> 使用 HKUST ITSO 登录 <ArrowRight />
              </Link>
            }
            size="lg"
            className="sso-button"
          />
          <small>
            登录只用于验证成员身份。真实姓名与邮箱默认不会向其他用户展示。
          </small>
        </div>
        <div
          className="welcome-visual"
          aria-label="Anonymous matching illustration"
        >
          <div className="welcome-node node-a">
            <strong>Hall VII</strong>
            <span>18 requests</span>
          </div>
          <div className="welcome-node node-b">
            <strong>Hall III</strong>
            <span>15 requests</span>
          </div>
          <div className="welcome-node node-c">
            <strong>GGT</strong>
            <span>13 requests</span>
          </div>
          <div className="welcome-connection">
            <ArrowRight />
            <span>双向匹配</span>
          </div>
          <div className="welcome-request">
            <span>
              <Network />
            </span>
            <div>
              <strong>Hall VII → Hall III</strong>
              <small>蓝鲸 271 · 匿名</small>
            </div>
          </div>
        </div>
      </section>
      <section className="welcome-trust">
        <div>
          <ShieldCheck />
          <span>
            <strong>仅限科大成员</strong>ITSO SSO 与 MFA 验证
          </span>
        </div>
        <div>
          <EyeOff />
          <span>
            <strong>个人资料默认隐藏</strong>双方同意后才交换联系方式
          </span>
        </div>
        <div>
          <Network />
          <span>
            <strong>为匹配而设计</strong>不是另一条无尽信息流
          </span>
        </div>
      </section>
      <footer className="welcome-footer">
        NODE 是独立社区项目，并非 HKUST 官方服务。换宿须通过 SHRLO 正式流程。
      </footer>
    </main>
  );
}
