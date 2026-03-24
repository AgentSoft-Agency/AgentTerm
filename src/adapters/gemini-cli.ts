import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { AgentAdapter, HookInput, HookResult } from './adapter.js';

const GEMINI_DIR = join(homedir(), '.gemini');
const SETTINGS_PATH = join(GEMINI_DIR, 'settings.json');

export class GeminiCliAdapter implements AgentAdapter {
  name = 'gemini-cli';
  displayName = 'Gemini CLI';
  configPath = SETTINGS_PATH;

  detect(): boolean {
    return existsSync(GEMINI_DIR);
  }

  register(): void {
    console.warn('Gemini CLI hook registration is not yet implemented. Hook format TBD.');
  }

  unregister(): void {
    console.warn('Gemini CLI hook unregistration is not yet implemented.');
  }

  parseHookInput(stdin: string): HookInput {
    try {
      const data = JSON.parse(stdin);
      return {
        command: data.tool_input?.command ?? '',
        sessionId: data.session_id,
      };
    } catch {
      return { command: '' };
    }
  }

  formatHookOutput(result: HookResult): string {
    if (result.action === 'passthrough') return '';

    return JSON.stringify({
      decision: 'allow',
      hookSpecificOutput: {
        tool_input: {
          command: result.rewrittenCommand ?? '',
        },
      },
      systemMessage: result.systemMessage ?? '',
    });
  }
}
