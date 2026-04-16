import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { AgentAdapter } from './adapter.js';

const CLAUDE_DIR = join(homedir(), '.claude');
const SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json');
const SKILL_DIR = join(CLAUDE_DIR, 'skills', 'agent-term');

export class ClaudeCodeAdapter implements AgentAdapter {
  name = 'claude-code';
  displayName = 'Claude Code';
  skillPath = SKILL_DIR;
  configPath = SETTINGS_PATH;

  detect(): boolean {
    return existsSync(CLAUDE_DIR);
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
