const SESSION_PREFIX = 'at-';
const MAX_NAME_LENGTH = 30;

/**
 * Generate a terminal name from a command string.
 * "pnpm dev" → "pnpm-dev"
 * "docker compose up --detach" → "docker-compose-up"
 */
export function autoName(command: string): string {
  const parts = command.trim().split(/\s+/);

  // Take words until we hit a flag (starts with -)
  const words: string[] = [];
  for (const part of parts) {
    if (part.startsWith('-')) break;
    // Strip leading path: /usr/bin/node → node, ./server.js → server.js
    const basename = part.replace(/^.*\//, '');
    if (basename) words.push(basename);
  }

  if (words.length === 0) return 'unknown';

  const name = words.join('-').toLowerCase();
  return name.slice(0, MAX_NAME_LENGTH);
}

/**
 * Resolve a name with collision suffix.
 * Given existing names ["pnpm-dev", "pnpm-dev-2"], returns "pnpm-dev-3".
 */
export function resolveCollision(baseName: string, existingNames: string[]): string {
  if (!existingNames.includes(baseName)) return baseName;

  let n = 2;
  while (existingNames.includes(`${baseName}-${n}`)) n++;
  return `${baseName}-${n}`;
}

/**
 * Convert a user-facing name to the tmux session name.
 * "pnpm-dev" → "at-pnpm-dev"
 */
export function toSessionName(name: string): string {
  return `${SESSION_PREFIX}${name}`;
}

/**
 * Convert a tmux session name back to user-facing name.
 * "at-pnpm-dev" → "pnpm-dev"
 */
export function fromSessionName(sessionName: string): string {
  return sessionName.startsWith(SESSION_PREFIX)
    ? sessionName.slice(SESSION_PREFIX.length)
    : sessionName;
}
