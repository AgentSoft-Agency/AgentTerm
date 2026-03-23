import { listSessionNames, getSessionStatus, getSessionCommand, getSessionCreated } from '../tmux.js';
import { fromSessionName } from '../naming.js';

interface TerminalInfo {
  name: string;
  command: string;
  pid: string;
  status: 'running' | 'exited';
  uptime: string;
}

function formatUptime(createdEpoch: number): string {
  if (!createdEpoch) return 'unknown';
  const seconds = Math.floor(Date.now() / 1000) - createdEpoch;
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function runList(json: boolean): void {
  const sessionNames = listSessionNames();

  if (sessionNames.length === 0) {
    if (json) {
      console.log('[]');
    } else {
      console.log('No active terminals.');
    }
    return;
  }

  const terminals: TerminalInfo[] = sessionNames.map((sn) => {
    const name = fromSessionName(sn);
    const { pid, dead } = getSessionStatus(sn);
    const command = getSessionCommand(sn);
    const created = getSessionCreated(sn);
    return {
      name,
      command,
      pid,
      status: dead ? 'exited' : 'running',
      uptime: formatUptime(created),
    };
  });

  if (json) {
    console.log(JSON.stringify(terminals, null, 2));
    return;
  }

  // Table output
  console.log('NAME'.padEnd(22) + 'STATUS'.padEnd(10) + 'UPTIME'.padEnd(8) + 'COMMAND');
  console.log('-'.repeat(60));
  for (const t of terminals) {
    console.log(t.name.padEnd(22) + t.status.padEnd(10) + t.uptime.padEnd(8) + t.command);
  }
}
