import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { AgentAdapter, HookInput, HookResult } from './adapter.js';

const CODEX_DIR = join(homedir(), '.codex');
const CONFIG_PATH = join(CODEX_DIR, 'config.json');

export class CodexCliAdapter implements AgentAdapter {
  name = 'codex-cli';
  displayName = 'Codex CLI';
  configPath = CONFIG_PATH;

  detect(): boolean {
    return existsSync(CODEX_DIR);
  }

  register(): void {
    console.warn('Codex CLI hook registration is not yet implemented. Hook format TBD.');
  }

  unregister(): void {
    console.warn('Codex CLI hook unregistration is not yet implemented.');
  }

  parseHookInput(stdin: string): HookInput {
    console.warn('Codex CLI hook parsing is not yet implemented. Passing through.');
    return { command: '' };
  }

  formatHookOutput(result: HookResult): string {
    return '';
  }
}
