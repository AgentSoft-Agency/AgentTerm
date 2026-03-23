import { sessionExists, getSessionStatus, capturePane } from '../tmux.js';
import { toSessionName } from '../naming.js';

export function runStatus(name: string): void {
  const sessionName = toSessionName(name);

  if (!sessionExists(sessionName)) {
    console.error(`Error: terminal '${name}' not found.`);
    process.exit(1);
  }

  const { pid, dead, exitCode } = getSessionStatus(sessionName);
  const status = dead ? 'exited' : 'running';
  const lastLines = capturePane(sessionName, 5);

  console.log(`Terminal: ${name}`);
  console.log(`Status:   ${status}`);
  console.log(`PID:      ${pid}`);
  if (dead && exitCode) {
    console.log(`Exit code: ${exitCode}`);
  }
  if (lastLines.trim()) {
    console.log(`\nLast output:\n${lastLines}`);
  }
}
