import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { AgentAdapter } from './adapter.js';

const CODEX_DIR = process.env.CODEX_HOME ?? join(homedir(), '.codex');
const CONFIG_PATH = join(CODEX_DIR, 'config.toml');
const SKILL_DIR = join(CODEX_DIR, 'skills', 'agent-term');

export class CodexCliAdapter implements AgentAdapter {
  name = 'codex-cli';
  displayName = 'Codex CLI';
  skillPath = SKILL_DIR;
  configPath = CONFIG_PATH;

  detect(): boolean {
    return existsSync(CODEX_DIR);
  }

  installSkill(): void {
    throw new Error('not implemented');
  }

  uninstallSkill(): void {
    throw new Error('not implemented');
  }

  removeLegacyHooks(): { removed: boolean } {
    throw new Error('not implemented');
  }
}
