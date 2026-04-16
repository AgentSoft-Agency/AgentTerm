import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
    rmSync(this.skillPath, { recursive: true, force: true });
  }

  removeLegacyHooks(): { removed: boolean } {
    if (!existsSync(this.configPath)) return { removed: false };

    let settings: any;
    try {
      settings = JSON.parse(readFileSync(this.configPath, 'utf-8'));
    } catch {
      return { removed: false };
    }

    if (!settings?.hooks) return { removed: false };

    const isAgentTermEntry = (entry: any): boolean =>
      Array.isArray(entry?.hooks) &&
      entry.hooks.some((h: any) => typeof h?.command === 'string' && h.command.includes('agent-term'));

    let changed = false;
    for (const key of ['PreToolUse', 'SessionStart']) {
      if (!Array.isArray(settings.hooks[key])) continue;
      const before = settings.hooks[key].length;
      settings.hooks[key] = settings.hooks[key].filter((entry: any) => !isAgentTermEntry(entry));
      if (settings.hooks[key].length !== before) changed = true;
    }

    if (!changed) return { removed: false };

    writeFileSync(this.configPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
    return { removed: true };
  }
}
