import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { AgentAdapter } from './adapter.js';

const GEMINI_DIR = join(homedir(), '.gemini');
const SETTINGS_PATH = join(GEMINI_DIR, 'settings.json');
const SKILL_DIR = join(GEMINI_DIR, 'skills', 'agent-term');

export class GeminiCliAdapter implements AgentAdapter {
  name = 'gemini-cli';
  displayName = 'Gemini CLI';
  skillPath = SKILL_DIR;
  configPath = SETTINGS_PATH;

  detect(): boolean {
    return existsSync(GEMINI_DIR);
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
