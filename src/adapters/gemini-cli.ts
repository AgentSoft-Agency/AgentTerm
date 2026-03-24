import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import type { AgentAdapter, HookInput, HookResult } from './adapter.js';
import { buildContextText } from './context.js';

const GEMINI_DIR = join(homedir(), '.gemini');
const SETTINGS_PATH = join(GEMINI_DIR, 'settings.json');

export class GeminiCliAdapter implements AgentAdapter {
  name = 'gemini-cli';
  displayName = 'Gemini CLI';
  configPath = SETTINGS_PATH;

  detect(): boolean {
    return existsSync(GEMINI_DIR);
  }

  isSessionStart(stdin: string): boolean {
    try {
      const data = JSON.parse(stdin);
      return data.hook_event_name === 'SessionStart';
    } catch {
      return false;
    }
  }

  generateContext(): string {
    return buildContextText();
  }

  register(): void {
    const settings = this.readSettings();
    if (!settings.hooks) settings.hooks = {};

    const isAgentTerm = (entry: any) =>
      entry.hooks?.some((h: any) =>
        h.name === 'agent-term' ||
        (typeof h.command === 'string' && h.command.includes('agent-term')),
      );

    let changed = false;

    // SessionStart hook
    if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];
    if (!(settings.hooks.SessionStart as any[]).some(isAgentTerm)) {
      (settings.hooks.SessionStart as any[]).push({
        hooks: [{
          name: 'agent-term',
          type: 'command',
          command: 'agent-term hook --agent gemini-cli',
        }],
      });
      changed = true;
    }

    // BeforeTool hook
    if (!settings.hooks.BeforeTool) settings.hooks.BeforeTool = [];
    if (!(settings.hooks.BeforeTool as any[]).some(isAgentTerm)) {
      (settings.hooks.BeforeTool as any[]).push({
        matcher: 'run_shell_command',
        hooks: [{
          name: 'agent-term',
          type: 'command',
          command: 'agent-term hook --agent gemini-cli',
          timeout: 15000,
        }],
      });
      changed = true;
    }

    if (!changed) return;
    this.writeSettings(settings);
  }

  unregister(): void {
    const settings = this.readSettings();
    if (!settings.hooks) return;

    const filterAgentTerm = (entries: any[]) =>
      entries.filter((entry: any) => !entry.hooks?.some((h: any) =>
        h.name === 'agent-term' ||
        (typeof h.command === 'string' && h.command.includes('agent-term')),
      ));

    if (settings.hooks.BeforeTool) {
      settings.hooks.BeforeTool = filterAgentTerm(settings.hooks.BeforeTool);
      if ((settings.hooks.BeforeTool as any[]).length === 0) delete settings.hooks.BeforeTool;
    }
    if (settings.hooks.SessionStart) {
      settings.hooks.SessionStart = filterAgentTerm(settings.hooks.SessionStart);
      if ((settings.hooks.SessionStart as any[]).length === 0) delete settings.hooks.SessionStart;
    }

    this.writeSettings(settings);
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

    if (result.action === 'output') {
      const tmpFile = join(tmpdir(), `agent-term-${randomBytes(4).toString('hex')}.out`);
      writeFileSync(tmpFile, result.stdout ?? '', 'utf-8');
      return JSON.stringify({
        decision: 'allow',
        hookSpecificOutput: {
          tool_input: {
            command: `cat ${tmpFile}`,
          },
        },
        systemMessage: result.systemMessage ?? '',
      });
    }

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

  private readSettings(): any {
    if (!existsSync(SETTINGS_PATH)) return {};
    try {
      return JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
    } catch {
      return {};
    }
  }

  private writeSettings(settings: any): void {
    mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
    writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  }
}
