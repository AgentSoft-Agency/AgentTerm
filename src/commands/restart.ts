import { killSession, sessionExists, getSessionCommand, createSession, capturePane } from '../tmux.js';
import { toSessionName } from '../naming.js';

export function runRestart(name: string): void {
  const sessionName = toSessionName(name);

  if (!sessionExists(sessionName)) {
    console.error(`Error: terminal '${name}' not found.`);
    process.exit(1);
  }

  // Capture the original command before killing
  const command = getSessionCommand(sessionName);
  if (!command) {
    console.error(`Error: could not determine command for terminal '${name}'.`);
    process.exit(1);
  }

  // Strip the /bin/sh wrapper that createSessionWithRemainOnExit adds
  const unwrapped = unwrapCommand(command);

  killSession(sessionName);
  createSession(sessionName, unwrapped);

  // Wait for initial output
  const start = Date.now();
  const timeout = 3000;

  const check = () => {
    const output = capturePane(sessionName, 50).trim();
    if (output) {
      console.log(`Terminal '${name}' restarted:\n`);
      console.log(output);
      return;
    }
    if (Date.now() - start < timeout) {
      setTimeout(check, 200);
    } else {
      console.log(`Terminal '${name}' restarted, awaiting output...`);
    }
  };

  check();
}

/**
 * Strip the /bin/sh -c wrapper added by createSessionWithRemainOnExit.
 * Input:  /bin/sh -c "tmux set-option -w remain-on-exit on 2>/dev/null; pnpm dev"
 * Output: pnpm dev
 */
function unwrapCommand(command: string): string {
  const match = command.match(/remain-on-exit on 2>\/dev\/null;\s*(.+)"?\s*$/);
  if (match) return match[1].replace(/"$/, '').trim();
  return command;
}
