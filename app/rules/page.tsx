import Link from 'next/link';
import { ArrowLeft, Scale, ShieldCheck } from 'lucide-react';

import { forbiddenContent } from '@/lib/content-policy';

export default function CommunityRulesPage() {
  return (
    <main className="rules-page">
      <header className="rules-header">
        <Link href="/">
          <ArrowLeft /> 返回广场
        </Link>
        <div className="brand">
          <span className="brand-mark">
            <span />
          </span>
          <span>NODE</span>
        </div>
      </header>
      <article className="rules-document">
        <div className="rules-kicker">
          <ShieldCheck /> COMMUNITY STANDARD · V1.0
        </div>
        <h1>社区规则与内容边界</h1>
        <p className="rules-lead">
          NODE 用于 HKUST
          成员之间安全、匿名地寻找交换与互助对象。匿名不是免责：平台会保存经验证的账户身份，仅向获授权的管理团队开放，并按需要配合校方或执法机关处理严重违规。
        </p>
        <section className="rules-principles">
          <div>
            <strong>对社区匿名</strong>
            <span>默认不展示真实姓名、学号、邮箱、房号或联系方式。</span>
          </div>
          <div>
            <strong>对平台可追责</strong>
            <span>举报与管理操作有记录；严重或重复违规会导致停权或封禁。</span>
          </div>
          <div>
            <strong>换宿必须合规</strong>
            <span>本站只帮助寻找对象，最终须通过 SHRLO 官方流程办理。</span>
          </div>
        </section>
        <h2>禁止发布或传递的内容</h2>
        <div className="rule-grid">
          {forbiddenContent.map((rule, index) => (
            <section key={rule.code} className="rule-card">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{rule.label}</h3>
                <p>{rule.description}</p>
              </div>
            </section>
          ))}
        </div>
        <section className="enforcement">
          <Scale />
          <div>
            <h2>处置方式</h2>
            <p>
              管理员可隐藏或删除内容、发出警告、限制发帖、暂停账号或永久封禁。处理时会考虑严重程度、现实风险、重复行为与申诉材料。紧急人身安全事件请直接联系
              HKUST Security Control Center 或香港紧急服务。
            </p>
          </div>
        </section>
        <p className="rules-footnote">
          本规则不替代 HKUST
          的政策、宿舍规则或香港法律。正式上线前应由校方或法律顾问复核。
        </p>
      </article>
    </main>
  );
}
