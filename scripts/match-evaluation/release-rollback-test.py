"""Exercise existing release switcher in temporary directories; never call systemctl."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('switch_release',Path(__file__).parents[1]/'switch-release.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def build(path, name):
    (path/'standalone/.next/static').mkdir(parents=True)
    (path/'server').mkdir()
    (path/'BUILD_ID').write_text(name)
    (path/'standalone/.next/BUILD_ID').write_text(name)
    (path/'standalone/server.js').write_text('// synthetic release')
    (path/'server/app-paths-manifest.json').write_text(json.dumps({'/api/auth/[action]/route':'route.js'}))

for failure in [False,True]:
    with tempfile.TemporaryDirectory() as tmp:
        root=Path(tmp);m.ROOT=root/'app';m.ARCHIVE=root/'backups'
        m.ROOT.mkdir();target=root/'candidate';build(m.ROOT/'.next','previous');build(target,'candidate')
        env=m.ROOT/'.env.local';env.write_text('unchanged environment')
        data=root/'database-sentinel';data.write_text('new user data survives')
        calls=[];checks=iter([False,True] if failure else [True])
        with patch.object(sys,'argv',['switch-release.py',str(target)]),patch.object(m.subprocess,'check_output',return_value='email'),patch.object(m,'service',side_effect=calls.append),patch.object(m,'healthy',side_effect=lambda:next(checks)):
            try: m.main()
            except RuntimeError:
                assert failure
            else: assert not failure
        assert m.validate(m.ROOT/'.next')==('previous' if failure else 'candidate')
        record=json.loads(next(m.ARCHIVE.glob('switch-*/deployment.json')).read_text())
        assert record['status']==('rolled_back' if failure else 'healthy')
        assert record['databaseChanged'] is False
        assert env.read_text()=='unchanged environment' and data.read_text()=='new user data survives'
        assert calls==(['stop','start','stop','start'] if failure else ['stop','start'])
        assert m.validate(target)=='candidate'
        print('PASS', 'failed-health rollback' if failure else 'successful switch', 'preserves environment and data')
