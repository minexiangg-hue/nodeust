import Link from 'next/link';
import { ArrowLeft, Scale, ShieldCheck } from 'lucide-react';

import { forbiddenContent } from '@/lib/content-policy';

export default function CommunityRulesPage() {
  return (
    <main className="rules-page">
      <header className="rules-header">
        <Link href="/">
          <ArrowLeft /> Back to plaza
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
        <h1>Community rules and content boundaries</h1>
        <p className="rules-lead">
          NODE helps HKUST members find exchange and mutual-help partners safely
          and anonymously. Anonymous does not mean unaccountable: NODE retains
          verified account identity for authorised moderators and may cooperate
          with the University or law enforcement on serious cases.
        </p>
        <section className="rules-principles">
          <div>
            <strong>Anonymous to the community</strong>
            <span>
              Real names, IDs, email, room numbers and contact details stay
              hidden.
            </span>
          </div>
          <div>
            <strong>Accountable to the platform</strong>
            <span>
              Reports and moderation actions are logged. Serious or repeated
              violations may lead to suspension or a ban.
            </span>
          </div>
          <div>
            <strong>Hall changes must be compliant</strong>
            <span>
              NODE only helps people connect. Every change must go through the
              official SHRLO process.
            </span>
          </div>
        </section>
        <h2>Content you may not publish or send</h2>
        <div className="rule-grid">
          {forbiddenContent.map((rule, index) => (
            <section key={rule.code} className="rule-card">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{rule.labelEn}</h3>
                <p>{rule.descriptionEn}</p>
              </div>
            </section>
          ))}
        </div>
        <section className="enforcement">
          <Scale />
          <div>
            <h2>Enforcement</h2>
            <p>
              Moderators may hide or remove content, issue warnings, restrict
              posting, suspend accounts or permanently ban users. Decisions
              consider severity, real-world risk, repeated behaviour and appeal
              evidence. For urgent threats to personal safety, contact the HKUST
              Security Control Center or Hong Kong emergency services directly.
            </p>
          </div>
        </section>
        <p className="rules-footnote">
          These rules do not replace HKUST policies, residence rules or Hong
          Kong law. They should be reviewed by the University or legal counsel
          before public launch.
        </p>
      </article>
    </main>
  );
}
