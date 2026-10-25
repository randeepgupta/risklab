"""Install a per-user macOS launchd job for Saturday at 22:00, system local time."""
import os
import pathlib
import plistlib
import shutil
import subprocess
import sys

LABEL = 'com.risklab.weekly-refresh'


def configuration(runner, state, path):
    return {
        'Label': LABEL,
        'ProgramArguments': ['/usr/bin/caffeinate', '-i', sys.executable, str(runner), '--state-dir', str(state)],
        'StartCalendarInterval': {'Weekday': 6, 'Hour': 22, 'Minute': 0},
        'EnvironmentVariables': {'PATH': path},
        'StandardOutPath': str(state/'launchd.log'),
        'StandardErrorPath': str(state/'launchd-error.log'),
        'ProcessType': 'Background',
    }


if __name__ == '__main__':
    state = pathlib.Path.home()/'Library/Application Support/RiskLab/weekly-refresh'
    agent = pathlib.Path.home()/'Library/LaunchAgents'/f'{LABEL}.plist'
    tool_dirs = []
    for tool in ['git', 'gh', 'node', 'npm', 'python3']:
        executable = shutil.which(tool)
        if not executable:
            raise SystemExit(f'Missing required tool: {tool}')
        tool_dirs.append(str(pathlib.Path(executable).parent))
    subprocess.run(['gh', 'auth', 'status'], check=True)
    state.mkdir(parents=True, exist_ok=True)
    agent.parent.mkdir(parents=True, exist_ok=True)
    runner = state/'run.py'
    shutil.copyfile(pathlib.Path(__file__).with_name('run.py'), runner)
    path = ':'.join(dict.fromkeys(tool_dirs + ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin']))
    agent.write_bytes(plistlib.dumps(configuration(runner, state, path)))
    domain = f'gui/{os.getuid()}'
    # Reinstallation replaces the existing schedule without starting an extra run.
    subprocess.run(['launchctl', 'bootout', f'{domain}/{LABEL}'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(['launchctl', 'bootstrap', domain, str(agent)], check=True)
    subprocess.run(['launchctl', 'enable', f'{domain}/{LABEL}'], check=True)
    print(f'Installed {agent}: Saturdays at 22:00 in the Mac system time zone.')
