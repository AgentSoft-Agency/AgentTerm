import { capturePane, sessionExists } from '../tmux.js';
import { toSessionName } from '../naming.js';

export function runLogs(name: string, lines: number): void {
  const sessionName = toSessionName(name);

  if (!sessionExists(sessionName)) {
    console.error(`Error: terminal '${name}' not found. Run 'agent-term list' to see active terminals.`);
    process.exit(1);
  }

  const output = capturePane(sessionName, lines);
  console.log(output);
}
