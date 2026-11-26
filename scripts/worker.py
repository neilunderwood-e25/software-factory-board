"""Run once on the Air. No listener or ticket-supplied code."""
import hashlib
import json
import os
from pathlib import Path
import tempfile
import subprocess
from urllib.parse import urlsplit
from urllib.request import build_opener, HTTPRedirectHandler, Request

TICKET = 'northstar-glossary-v1'
CONTENT = """# Northstar security glossary

## Signal
An observation that may help an analyst spot unusual activity.

## Incident
A group of related observations that warrants investigation.

## Containment
A response that limits an incident's impact while investigation continues.
"""
class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args):
        return None

def run():
    origin = urlsplit(os.environ['FACTORY_SITE'])
    if origin.scheme != 'https' or origin.hostname != 'nadun-software-factory-board.netlify.app' or origin.netloc!=origin.hostname or origin.path not in ('','/') or origin.query or origin.fragment:
        raise ValueError('Use the verified HTTPS Netlify project origin')
    key=os.environ['FACTORY_WORKER_KEY']
    if len(key)<32: raise ValueError('Worker key is missing')
    url='https://'+origin.hostname+'/api/board'
    def post(body):
        req=Request(url,json.dumps(body).encode(),{'Authorization':'Bearer '+key,'Content-Type':'application/json'})
        with build_opener(NoRedirect()).open(req,timeout=15) as response:
            return json.load(response)
    job=post({'action':'claim'})['job']
    if not job: print('No queued ticket'); return
    if job['id']!=TICKET: raise ValueError('Unrecognized ticket')
    directory=Path.home()/'Documents/repos/northstar-hosted-demo'
    passed=False
    try:
        directory.mkdir(mode=0o700,exist_ok=True)
        if directory.resolve()!=directory: raise ValueError('Unexpected workspace')
        target=directory/'glossary.md'
        payload=CONTENT.encode()
        if target.is_symlink() or (target.exists() and target.read_bytes()!=payload):
            raise ValueError('Existing glossary differs from the fixed recipe')
        if not target.exists():
            with tempfile.TemporaryDirectory(prefix='glossary-',dir=directory) as stage:
                # The model receives a checked-in specification, never hosted ticket text.
                prompt='Write only glossary.md, using exactly the following fixed Markdown, including the final newline. No tools beyond writing the file, no network, no Git.\n\n'+CONTENT
                env={k:v for k,v in os.environ.items() if k in ('HOME','PATH','LANG','LC_ALL','TMPDIR')}
                subprocess.run([Path.home()/'.local/opt/chatgpt/resources/codex','exec','--skip-git-repo-check',
                                '--cd',stage,'--sandbox','workspace-write','-c','approval_policy="never"',
                                '-c','sandbox_workspace_write.network_access=false','-c','mcp_servers={}',
                                '--disable','apps',prompt],env=env,stdin=subprocess.DEVNULL,check=True,timeout=120)
                generated=Path(stage)/'glossary.md'
                if generated.is_symlink() or not generated.is_file() or generated.stat().st_size!=len(payload) or generated.read_bytes()!=payload:
                    raise ValueError('Generated glossary did not match the trusted fixture')
                try: os.link(generated,target)
                except FileExistsError: pass
        passed=not target.is_symlink() and target.read_bytes()==payload and CONTENT.count('## ')==3
        if passed: print(target,hashlib.sha256(payload).hexdigest())
    finally:
        post({'action':'finish','lease':job['lease'],'passed':passed})
    if not passed: raise ValueError('Glossary verification failed')

if __name__=='__main__': run()
