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
        <Link href="/rules">Community rules</Link>
      </header>
      <section className="welcome-main">
        <div className="welcome-copy">
          <div className="rules-kicker">
            <span className="pulse-dot" /> VERIFIED COMMUNITY · ANONYMOUS BY
            DEFAULT
          </div>
          <h1>
            Find the person
            <br />
            whose need fits yours.
          </h1>
          <p>
            An anonymous exchange map for HKUST students, faculty and staff.
            Discover nearby needs, find reciprocal matches and stay anonymous
            until both people choose otherwise.
          </p>
          <Button
            render={
              <Link
                href="/auth/hkust"
                prefetch={false}
                target="_top"
                aria-label="Sign in with HKUST ITSO"
              >
                <ShieldCheck /> Sign in with HKUST ITSO <ArrowRight />
              </Link>
            }
            size="lg"
            className="sso-button"
          />
          <small>
            Sign-in verifies community membership only. Your real name and email
            stay private by default.
          </small>
        </div>
        <div
          className="welcome-visual"
          aria-label="Anonymous matching illustration"
        >
          <div className="welcome-node node-a">
            <strong>Hall VII</strong>
            <span>UG HOUSING</span>
          </div>
          <div className="welcome-node node-b">
            <strong>Hall III</strong>
            <span>UG HOUSING</span>
          </div>
          <div className="welcome-node node-c">
            <strong>GGT</strong>
            <span>PG HOUSING</span>
          </div>
          <div className="welcome-connection">
            <ArrowRight />
            <span>RECIPROCAL MATCH</span>
          </div>
          <div className="welcome-request">
            <span>
              <Network />
            </span>
            <div>
              <strong>Hall VII → Hall III</strong>
              <small>Blue Whale 271 · Anonymous</small>
            </div>
          </div>
        </div>
      </section>
      <section className="welcome-trust">
        <div>
          <ShieldCheck />
          <span>
            <strong>HKUST members only</strong>Verified through ITSO SSO and MFA
          </span>
        </div>
        <div>
          <EyeOff />
          <span>
            <strong>Private by default</strong>Contact details require mutual
            consent
          </span>
        </div>
        <div>
          <Network />
          <span>
            <strong>Designed for matching</strong>Not another endless social
            feed
          </span>
        </div>
      </section>
      <footer className="welcome-footer">
        NODE is an independent community project, not an official HKUST service.
        Hall changes must follow the formal SHRLO process.
      </footer>
    </main>
  );
}
