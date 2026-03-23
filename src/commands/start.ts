import { createSession, sessionExists, capturePane, listSessionNames } from '../tmux.js';
import { autoName, resolveCollision, toSessionName, fromSessionName } from '../naming.js';

export function runStart(args: string[], name?: string): void {
  const command = args.join(' ');
  if (!command) {
    console.error('Error: no command specified. Usage: agent-term start -- <command>');
    process.exit(1);
  }

  const baseName = name ?? autoName(command);
  const sessionName = toSessionName(baseName);

  // Handle TOCTOU race: if session already exists, show logs
  if (sessionExists(sessionName)) {
    console.log(`Terminal '${baseName}' is already running. Showing recent output:\n`);
    console.log(capturePane(sessionName, 50));
    return;
  }

  // Handle name collision for explicit --name
  if (name) {
    const existing = listSessionNames().map(fromSessionName);
    const resolved = resolveCollision(baseName, existing);
    if (resolved !== baseName) {
      const resolvedSession = toSessionName(resolved);
      createSession(resolvedSession, command);
      return waitForOutput(resolved, resolvedSession);
    }
  }

  createSession(sessionName, command);
  waitForOutput(baseName, sessionName);
}

function waitForOutput(name: string, sessionName: string): void {
  const start = Date.now();
  const timeout = 3000;

  const check = () => {
    const output = capturePane(sessionName, 50).trim();
    if (output) {
      console.log(`Terminal '${name}' started:\n`);
      console.log(output);
      return;
    }
    if (Date.now() - start < timeout) {
      setTimeout(check, 200);
    } else {
      console.log(`Terminal '${name}' started, awaiting output...`);
    }
  };

  check();
}
