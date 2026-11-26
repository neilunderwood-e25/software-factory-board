"""Run once on the Air. No listener, child process or ticket-supplied code."""
import hashlib
import json
import os
from pathlib import Path
import tempfile
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
    if origin.scheme != 'https' or not origin.hostname or not origin.hostname.endswith('.netlify.app') or origin.netloc!=origin.hostname or origin.path not in ('','/') or origin.query or origin.fragment:
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
        with tempfile.NamedTemporaryFile(dir=directory,delete=False) as f:
            f.write(payload); stage=Path(f.name)
        try:
            if not target.exists():
                try: os.link(stage,target)
                except FileExistsError: pass
            passed=not target.is_symlink() and target.read_bytes()==payload and CONTENT.count('## ')==3
        finally: stage.unlink()
        if passed: print(target,hashlib.sha256(payload).hexdigest())
    finally:
        post({'action':'finish','lease':job['lease'],'passed':passed})
    if not passed: raise ValueError('Glossary verification failed')

if __name__=='__main__': run()
