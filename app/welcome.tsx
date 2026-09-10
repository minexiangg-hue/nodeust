import Link from 'next/link';
import Image from 'next/image';
import { HomePage } from '@/components/community/home-page';
export function Welcome() {
  return (
    <div className="public-home">
      <header className="public-header">
        <Link className="brand" href="/">
          <Image src="/node-brand-icon.png" alt="" width={34} height={34} />
          NODE
        </Link>
        <nav>
          <Link href="/rules">Community rules</Link>
          <Link
            className="button-link post-button"
            href="/__gateway/login?next=/explore"
            prefetch={false}
          >
            Sign in
          </Link>
        </nav>
      </header>
      <main className="public-home-content">
        <HomePage locale="en" signedIn={false} />
      </main>
      <footer className="public-footer">
        NODE is an independent HKUST community project. Hall changes must follow
        the official SHRLO process.
      </footer>
    </div>
  );
}
