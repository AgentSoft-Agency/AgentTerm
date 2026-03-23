import { killSession, sessionExists } from '../tmux.js';
import { toSessionName } from '../naming.js';

export function runKill(name: string): void {
  const sessionName = toSessionName(name);

  if (!sessionExists(sessionName)) {
    console.error(`Error: terminal '${name}' not found.`);
    process.exit(1);
  }

  killSession(sessionName);
  console.log(`Terminal '${name}' killed.`);
}
