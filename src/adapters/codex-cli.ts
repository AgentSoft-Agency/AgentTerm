import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import type { AgentAdapter } from './adapter.js';

const CODEX_DIR = process.env.CODEX_HOME ?? join(homedir(), '.codex');
const CONFIG_PATH = join(CODEX_DIR, 'config.toml');
const SKILL_DIR = join(CODEX_DIR, 'skills', 'agent-term');
const HOOK_MARKER = '# agent-term hook';

function readBundledSkill(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(here, '..', 'assets', 'SKILL.md'), 'utf-8');
}

export class CodexCliAdapter implements AgentAdapter {
  name = 'codex-cli';
  displayName = 'Codex CLI';
  skillPath = SKILL_DIR;
  configPath = CONFIG_PATH;

  detect(): boolean {
    return existsSync(CODEX_DIR);
  }

  installSkill(): void {
    mkdirSync(this.skillPath, { recursive: true });
    writeFileSync(join(this.skillPath, 'SKILL.md'), readBundledSkill(), 'utf-8');
  }

  uninstallSkill(): void {
    rmSync(this.skillPath, { recursive: true, force: true });
  }

  removeLegacyHooks(): { removed: boolean } {
    if (!existsSync(this.configPath)) return { removed: false };

    let content: string;
    try {
      content = readFileSync(this.configPath, 'utf-8');
    } catch {
      return { removed: false };
    }

    if (!content.includes('agent-term')) return { removed: false };

    const lines = content.split('\n');
    const filtered: string[] = [];
    let skipping = false;

    for (const line of lines) {
      if (line.trim() === HOOK_MARKER) {
        skipping = true;
        continue;
      }
      if (skipping) {
        if (
          line.startsWith('[[hooks]]') ||
          line.startsWith('event ') || line.startsWith('event=') ||
          line.startsWith('command ') || line.startsWith('command=')
        ) continue;
        if (line.trim() === '') { skipping = false; continue; }
        skipping = false;
      }
      filtered.push(line);
    }

    writeFileSync(this.configPath, filtered.join('\n'), 'utf-8');
    return { removed: true };
  }
}
