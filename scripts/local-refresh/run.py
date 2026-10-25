"""Refresh in an isolated checkout and open a data PR; no AI service is involved."""
import argparse
import datetime as dt
import fcntl
import json
import os
import pathlib
import subprocess
import tempfile
import traceback

REPO = 'randeepgupta/risklab'
BRANCH_PREFIX = 'codex/risk-models-'
CHECKS = ['lint', 'test:quant', 'test:history', 'test:ai', 'test:symbols', 'test:sample', 'test:future', 'build', 'build:cloudflare']


def run_job(state, validate_only=False):
    state.mkdir(parents=True, exist_ok=True)
    with (state/'run.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return {'status': 'already_running'}
        logs = state/'logs'
        logs.mkdir(exist_ok=True)
        stamp = dt.datetime.now().strftime('%Y-%m-%d-%H%M%S')
        logfile = logs/f'{stamp}.log'
        print(f'RiskLab refresh log: {logfile}', flush=True)
        with logfile.open('w') as log:
            def command(*args, cwd=None, capture=False):
                print('> ' + ' '.join(args), file=log, flush=True)
                result = subprocess.run(args, cwd=cwd, check=True, text=True,
                                        stdout=subprocess.PIPE if capture else log, stderr=log,
                                        env={**os.environ, 'GIT_TERMINAL_PROMPT': '0', 'GH_PROMPT_DISABLED': '1'})
                return result.stdout.strip() if capture else None

            def finish(status, **details):
                result = {'status': status, 'finishedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'log': str(logfile), **details}
                temporary = state/'status.tmp'
                temporary.write_text(json.dumps(result, indent=2)+'\n')
                os.replace(temporary, state/'status.json')
                print(json.dumps(result), flush=True)
                return result

            try:
                command('gh', 'auth', 'status')
                prs = json.loads(command('gh', 'pr', 'list', '--repo', REPO, '--state', 'open', '--json', 'headRefName,url', '--limit', '100', capture=True))
                pending = next((pr for pr in prs if pr['headRefName'].startswith(BRANCH_PREFIX)), None)
                if pending and not validate_only:
                    return finish('awaiting_approval', url=pending['url'])
                with tempfile.TemporaryDirectory(prefix='checkout-', dir=state) as temp:
                    checkout = pathlib.Path(temp)/'risklab'
                    command('git', 'clone', '--depth', '1', '--branch', 'main', f'https://github.com/{REPO}.git', str(checkout))
                    manifest = checkout/'public/models/historical-snapshot.json'
                    before = json.loads(manifest.read_text())
                    command('npm', 'ci', cwd=checkout)
                    command('npm', 'run', 'refresh:risk-models', cwd=checkout)
                    after = json.loads(manifest.read_text())
                    # Capture time alone is not a data update.
                    before.pop('capturedAt', None)
                    after.pop('capturedAt', None)
                    if before == after and not validate_only:
                        return finish('unchanged', asOf=after['asOf'])
                    for check in CHECKS:
                        command('npm', 'run', check, cwd=checkout)
                    if validate_only:
                        return finish('validated', asOf=after['asOf'], covered=after['coverage']['covered'])
                    # Prune old parts only in this disposable checkout. Main and
                    # the developer's checkout are never changed by this job.
                    referenced = set(after.get('parts', []))
                    for part in (checkout/'public/models').glob('history-*.json'):
                        if part.name not in referenced:
                            part.unlink()
                    branch = BRANCH_PREFIX + stamp
                    command('git', 'switch', '-c', branch, cwd=checkout)
                    command('git', 'add', 'public/models', cwd=checkout)
                    command('git', '-c', 'user.name=RiskLab Refresh', '-c', 'user.email=risklab-refresh@users.noreply.github.com', 'commit', '-m', f"Refresh historical models through {after['asOf']}", cwd=checkout)
                    command('git', 'push', '-u', 'origin', branch, cwd=checkout)
                    body = checkout/'refresh-pr.md'
                    body.write_text(f"Weekly local batch refresh through **{after['asOf']}**.\n\n"
                                    f"Coverage: {json.dumps(after['coverage'])}.\n\n"
                                    "All test suites, TypeScript checks, and Node/Cloudflare builds passed. "
                                    "The refresh ran locally without AI calls.\n\n"
                                    "Awaiting your approval before merging; Cloudflare deploys after merge.\n")
                    url = command('gh', 'pr', 'create', '--repo', REPO, '--base', 'main', '--head', branch,
                                  '--title', f"Weekly risk model refresh: {after['asOf']}", '--body-file', str(body), cwd=checkout, capture=True)
                    return finish('pr_created', url=url, asOf=after['asOf'], covered=after['coverage']['covered'])
            except Exception as error:
                traceback.print_exc(file=log)
                finish('failed', error=str(error))
                raise


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--state-dir', type=pathlib.Path, default=pathlib.Path.home()/'Library/Application Support/RiskLab/weekly-refresh')
    parser.add_argument('--validate-only', action='store_true', help='Run the full pipeline without pushing a branch or creating a PR')
    args = parser.parse_args()
    run_job(args.state_dir.resolve(), args.validate_only)
