import { Clock3, ShieldCheck, Wrench } from 'lucide-react';

export function MaintenanceScreen() {
  const expectedReturn =
    process.env.NODE_MAINTENANCE_RETURN || 'Check back soon';
  const statusUrl = process.env.NODE_STATUS_URL;

  return (
    <main className="maintenance-page">
      <div className="maintenance-orbit" aria-hidden="true">
        <span />
      </div>
      <section className="maintenance-card">
        <div className="brand">
          <span className="brand-mark">
            <span />
          </span>
          <span>NODE</span>
          <span className="maintenance-badge">MAINTENANCE</span>
        </div>
        <div className="maintenance-icon">
          <Wrench />
        </div>
        <p className="maintenance-kicker">SERVICE WINDOW</p>
        <h1>We’ll be back shortly.</h1>
        <p>
          NODE is temporarily unavailable while we improve reliability and
          protect community data. No action is required from you.
        </p>
        <div className="maintenance-time">
          <Clock3 />
          <span>
            <small>Expected return</small>
            <strong>{expectedReturn}</strong>
          </span>
        </div>
        <div className="maintenance-translations">
          <p>系统正在维护升级，请稍后再试。</p>
          <p>系統正在維護升級，請稍後再試。</p>
        </div>
        <footer>
          <span>
            <ShieldCheck /> Your identity and private data remain protected.
          </span>
          {statusUrl && <a href={statusUrl}>View service status</a>}
        </footer>
      </section>
    </main>
  );
}
