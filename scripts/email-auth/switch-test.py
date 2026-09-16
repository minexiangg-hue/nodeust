import importlib.util
from pathlib import Path
import shutil
import tempfile
from types import SimpleNamespace

spec=importlib.util.spec_from_file_location('auth_switch',Path(__file__).with_name('switch-system.py'))
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
original_run=m.subprocess.run
try:
 for system,failure in [('email',None),('legacy',None),('email','health'),('email','nginx')]:
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);m.ROOT=root/'app';m.BACKUPS=root/'backups';m.NGINX=root/'nginx.conf';bundle=root/'bundle'
   for p in [m.ROOT,m.BACKUPS,bundle]:p.mkdir()
   def build(path,value):
    (path/'standalone/.next/static').mkdir(parents=True)
    (path/'BUILD_ID').write_text(value);(path/'standalone/.next/BUILD_ID').write_text(value);(path/'standalone/server.js').write_text('// fixture')
   build(m.ROOT/'.next','serving');build(bundle/'candidate-next','email');build(bundle/'previous-next','legacy')
   (m.ROOT/'.env.local').write_text('serving-env');m.NGINX.write_text('serving-proxy')
   (bundle/'email.env').write_text('email-env');(bundle/'app.env').write_text('legacy-env')
   (bundle/'email-nginx.conf').write_text('email-proxy');(bundle/'nginx.conf').write_text('legacy-proxy');(bundle/'legacy-nginx.conf').write_text('legacy-proxy')
   data=root/'business-data';data.write_text('both realms must survive')
   calls=[]
   def command(*args):
    calls.append(args)
    if failure=='nginx' and args[-2:]==('nginx','-t') and m.NGINX.read_text()=='email-proxy':raise RuntimeError('synthetic invalid config')
   m.run=command;m.service=lambda action,name:calls.append((action,name));m.install_nginx=lambda source:shutil.copyfile(source,m.NGINX);m.preflight=lambda *args:None
   m.subprocess.run=lambda *args,**kwargs:SimpleNamespace(returncode=0)
   checks=iter([False,True] if failure=='health' else [True]);m.healthy=lambda:next(checks)
   try:m.switch(system,bundle)
   except RuntimeError:assert failure
   expected='serving' if failure else system
   assert m.validate_build(m.ROOT/'.next')==expected
   assert (m.ROOT/'.env.local').read_text()==expected+'-env'
   assert m.NGINX.read_text()==expected+'-proxy'
   assert data.read_text()=='both realms must survive'
   print('PASS',system,failure or 'success','preserves data and correct build/env/proxy')
finally:m.subprocess.run=original_run
