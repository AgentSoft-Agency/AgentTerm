import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import type { AgentAdapter } from './adapter.js';

const CLAUDE_DIR = join(homedir(), '.claude');
const SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json');
const SKILL_DIR = join(CLAUDE_DIR, 'skills', 'agent-term');

function readBundledSkill(): string {
  // In dist: .../dist/adapters/claude-code.js → ../assets/SKILL.md
  // In src (vitest):  .../src/adapters/claude-code.ts → ../assets/SKILL.md
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(here, '..', 'assets', 'SKILL.md'), 'utf-8');
}

export class ClaudeCodeAdapter implements AgentAdapter {
  name = 'claude-code';
  displayName = 'Claude Code';
  skillPath = SKILL_DIR;
  configPath = SETTINGS_PATH;

  detect(): boolean {
    return existsSync(CLAUDE_DIR);
  }

  installSkill(): void {
    mkdirSync(this.skillPath, { recursive: true });
    const body = readBundledSkill();
    writeFileSync(join(this.skillPath, 'SKILL.md'), body, 'utf-8');
  }

  uninstallSkill(): void {
    throw new Error('not implemented');
  }

  removeLegacyHooks(): { removed: boolean } {
    throw new Error('not implemented');
  }
}
