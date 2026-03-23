import { sendKeys, sessionExists } from '../tmux.js';
import { toSessionName } from '../naming.js';

export function runSend(name: string, input: string): void {
  const sessionName = toSessionName(name);

  if (!sessionExists(sessionName)) {
    console.error(`Error: terminal '${name}' not found.`);
    process.exit(1);
  }

  sendKeys(sessionName, input);
  console.log(`Sent to '${name}': ${input}`);
}
