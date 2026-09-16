#!/usr/bin/env python3
"""Switch the complete authentication realm: build, environment, proxy and gateway."""
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
BACKUPS = Path('/home/ubuntu/nodeust-backups')
NGINX = Path('/etc/nginx/sites-enabled/nodeust-preview.conf').resolve()
NODE = '/home/ubuntu/.nvm/versions/node/v24.18.0/bin/node'

def run(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL)

def service(action, name):
    run('sudo', '-n', 'systemctl', action, name)

def install_nginx(source):
    run('sudo', '-n', 'install', '-m', '644', str(source), str(NGINX))

def install_env(source):
    target = ROOT / ('.env-switch-' + uuid.uuid4().hex)
    shutil.copyfile(source, target)
    target.chmod(0o600)
    os.replace(target, ROOT / '.env.local')

def validate_build(path):
    build = (path / 'BUILD_ID').read_text().strip()
    assert build and (path / 'standalone/server.js').is_file()
    assert (path / 'standalone/.next/BUILD_ID').read_text().strip() == build
    assert (path / 'standalone/.next/static').is_dir()
    return build

def healthy():
    for _ in range(30):
        try:
            with urllib.request.urlopen('http://127.0.0.1:3000/api/health', timeout=2) as response:
                data = json.load(response)
                if data.get('status') == 'ok' and data.get('database') == 'reachable':
                    return True
        except (OSError, ValueError):
            pass
        time.sleep(1)
    return False

def preflight(system, environment):
    env = {k:v for k,v in os.environ.items() if not (k.startswith('NODE_EMAIL_') or k in ['NODE_AUTH_MODE','DATABASE_URL'])}
    args = [NODE, '--env-file='+str(environment)]
    if system == 'email':
        args += ['--experimental-strip-types', str(ROOT / 'scripts/email-auth/preflight.mjs')]
    else:
        args += ['-e', "if(process.env.NODE_AUTH_MODE && process.env.NODE_AUTH_MODE!=='legacy')process.exit(1);if(!process.env.DATABASE_URL)process.exit(1)"]
    subprocess.run(args, env=env, cwd=ROOT, check=True)

def switch(system, bundle, check=False):
    build = bundle / ('candidate-next' if system == 'email' else 'previous-next')
    environment = bundle / ('email.env' if system == 'email' else 'app.env')
    legacy_proxy = 'legacy-nginx.conf' if (bundle / 'legacy-nginx.conf').exists() else 'nginx.conf'
    nginx = bundle / ('email-nginx.conf' if system == 'email' else legacy_proxy)
    if system == 'email':
        assert (bundle / 'legacy-nginx.conf').is_file(), 'Prepare the HTTPS-preserving legacy rollback proxy first'
    assert environment.is_file() and nginx.is_file(), 'Complete realm configuration is required'
    target_id = validate_build(build)
    preflight(system, environment)
    if check:
        print(json.dumps({'system':system,'build':target_id,'preflight':'passed','nginxConfig':'validated during switch before reload'}))
        return
    with (BACKUPS / '.release.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        transaction = BACKUPS / ('auth-switch-' + time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()) + '-' + uuid.uuid4().hex[:8])
        transaction.mkdir(mode=0o700)
        incoming, previous = transaction / 'incoming-next', transaction / 'previous-next'
        shutil.copytree(build, incoming, symlinks=True)
        assert validate_build(incoming) == target_id
        shutil.copyfile(ROOT / '.env.local', transaction / 'previous.env')
        (transaction / 'previous.env').chmod(0o600)
        shutil.copyfile(NGINX, transaction / 'previous-nginx.conf')
        gateway_active = subprocess.run(['systemctl','is-active','--quiet','nodeust-gateway']).returncode == 0
        gateway_enabled = subprocess.run(['systemctl','is-enabled','--quiet','nodeust-gateway']).returncode == 0
        state = {'system':system,'build':target_id,'databaseRestore':False,'status':'prepared','bundle':str(bundle)}
        record = transaction / 'switch.json'
        record.write_text(json.dumps(state,indent=2)+'\n')
        moved = False
        try:
            install_nginx(nginx)
            run('sudo','-n','nginx','-t')
            service('stop','nodeust')
            (ROOT / '.next').rename(previous)
            moved = True
            incoming.rename(ROOT / '.next')
            install_env(environment)
            service('start','nodeust')
            if not healthy():
                raise RuntimeError('Target authentication realm health failed')
            run('sudo','-n','systemctl','enable' if system == 'legacy' else 'disable','nodeust-gateway')
            service('start' if system == 'legacy' else 'stop','nodeust-gateway')
            service('reload','nginx')
            state['status'] = 'healthy'
        except BaseException:
            service('stop','nodeust')
            if moved:
                if (ROOT / '.next').exists():
                    (ROOT / '.next').rename(transaction / 'failed-next')
                previous.rename(ROOT / '.next')
            install_env(transaction / 'previous.env')
            install_nginx(transaction / 'previous-nginx.conf')
            run('sudo','-n','nginx','-t')
            run('sudo','-n','systemctl','enable' if gateway_enabled else 'disable','nodeust-gateway')
            service('start' if gateway_active else 'stop','nodeust-gateway')
            service('start','nodeust')
            service('reload','nginx')
            state['status'] = 'rolled_back' if healthy() else 'rollback_health_failed'
            raise
        finally:
            record.write_text(json.dumps(state,indent=2)+'\n')
            print(json.dumps(state))

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('system', choices=['email','legacy'])
    parser.add_argument('bundle',type=Path)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    switch(args.system,args.bundle.resolve(),args.check)
