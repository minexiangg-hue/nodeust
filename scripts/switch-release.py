#!/usr/bin/env python3
"""Switch trusted local Next standalone builds, preserving data and failed releases."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import urllib.request
import uuid

ROOT = Path('/home/ubuntu/nodeust')
ARCHIVE = Path('/home/ubuntu/nodeust-backups')

def validate(path):
    build = (path / 'BUILD_ID').read_text().strip()
    assert build and (path / 'standalone/server.js').is_file(), 'Incomplete standalone build'
    assert (path / 'standalone/.next/BUILD_ID').read_text().strip() == build, 'Build ID mismatch'
    assert (path / 'standalone/.next/static').is_dir(), 'Missing static assets'
    return build

def service(action):
    subprocess.run(['sudo', '-n', 'systemctl', action, 'nodeust'], check=True)

def healthy():
    for _ in range(30):
        try:
            with urllib.request.urlopen('http://127.0.0.1:3000/api/health', timeout=2) as response:
                body = json.load(response)
                if body.get('status') == 'ok' and body.get('database') == 'reachable':
                    return True
        except (OSError, ValueError):
            pass
        time.sleep(1)
    return False

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('release', type=Path, help='Trusted complete .next directory, not source code')
    parser.add_argument('--check', action='store_true', help='Validate only; make no changes')
    args = parser.parse_args()
    target = args.release.resolve()
    active = ROOT / '.next'
    assert target != active.resolve(), 'Target is already active'
    assert not target.is_relative_to(active.resolve()), 'Target must be outside active build'
    target_id = validate(target)
    old_id = validate(active)
    if args.check:
        print(json.dumps({'from': old_id, 'to': target_id, 'validated': True}))
        return
    ARCHIVE.mkdir(mode=0o700, exist_ok=True)
    with (ARCHIVE / '.release.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        stamp = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()) + '-' + uuid.uuid4().hex[:8]
        transaction = ARCHIVE / ('switch-' + stamp)
        transaction.mkdir(mode=0o700)
        incoming, previous = transaction / 'incoming-next', transaction / 'previous-next'
        shutil.copytree(target, incoming, symlinks=True)
        assert validate(incoming) == target_id
        state = {'from': old_id, 'to': target_id, 'target': str(target), 'previous': str(previous),
                 'databaseChanged': False, 'status': 'prepared'}
        record = transaction / 'deployment.json'
        record.write_text(json.dumps(state, indent=2) + '\n')
        moved = False
        try:
            service('stop')
            active.rename(previous)
            moved = True
            incoming.rename(active)
            service('start')
            if not healthy():
                raise RuntimeError('New release health check failed')
            state['status'] = 'healthy'
        except BaseException:
            if moved:
                service('stop')
                if active.exists():
                    active.rename(transaction / 'failed-next')
                previous.rename(active)
                service('start')
                state['status'] = 'rolled_back' if healthy() else 'rollback_health_failed'
            else:
                service('start')
                state['status'] = 'not_switched'
            raise
        finally:
            record.write_text(json.dumps(state, indent=2) + '\n')
            print(json.dumps(state))

if __name__ == '__main__':
    main()
