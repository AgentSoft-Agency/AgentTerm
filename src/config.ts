import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.agent-term');
const CONFIG_FILE = join(CONFIG_DIR, 'config');

export const DEFAULT_CONFIG = `# Long-running dev servers
pnpm dev*
pnpm run dev*
npm run dev*
yarn dev*

# Docker
docker compose up*
docker-compose up*

# Watchers
pnpm run watch*
nodemon *
tsx watch *

# Custom
pnpm start*
`;

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

/**
 * Parse a config file string into an array of patterns.
 * Strips comments (#) and blank lines.
 */
export function parsePatterns(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

/**
 * Load patterns from the config file.
 * Returns empty array if config doesn't exist.
 */
export function loadPatterns(): string[] {
  if (!existsSync(CONFIG_FILE)) return [];
  const content = readFileSync(CONFIG_FILE, 'utf-8');
  return parsePatterns(content);
}

/**
 * Check if a command matches any pattern.
 * Patterns support trailing * as a glob wildcard.
 */
export function matchCommand(command: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      if (command.startsWith(prefix)) return true;
    } else {
      if (command === pattern) return true;
    }
  }
  return false;
}
