import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { GeminiCliAdapter } from '../src/adapters/gemini-cli.js';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

describe('GeminiCliAdapter', () => {
  const adapter = new GeminiCliAdapter();

  describe('parseHookInput', () => {
    it('extracts command and sessionId from BeforeTool stdin', () => {
      const stdin = JSON.stringify({
        session_id: 'gem-session-1',
        hook_event_name: 'BeforeTool',
        tool_name: 'run_shell_command',
        tool_input: { command: 'pnpm dev' },
        cwd: '/tmp/project',
        transcript_path: '/tmp/transcript',
        timestamp: '2026-03-24T12:00:00Z',
      });
      const result = adapter.parseHookInput(stdin);
      expect(result).toEqual({ command: 'pnpm dev', sessionId: 'gem-session-1' });
    });

    it('handles missing session_id', () => {
      const stdin = JSON.stringify({
        tool_input: { command: 'git status' },
      });
      const result = adapter.parseHookInput(stdin);
      expect(result).toEqual({ command: 'git status', sessionId: undefined });
    });

    it('returns empty command when tool_input is missing', () => {
      const stdin = JSON.stringify({ session_id: 'abc' });
      const result = adapter.parseHookInput(stdin);
      expect(result).toEqual({ command: '', sessionId: 'abc' });
    });

    it('returns empty command when tool_input.command is missing', () => {
      const stdin = JSON.stringify({ tool_input: { args: ['--flag'] } });
      const result = adapter.parseHookInput(stdin);
      expect(result).toEqual({ command: '', sessionId: undefined });
    });

    it('returns empty command for malformed JSON', () => {
      const result = adapter.parseHookInput('not json {{{');
      expect(result).toEqual({ command: '' });
    });

    it('returns empty command for empty string', () => {
      const result = adapter.parseHookInput('');
      expect(result).toEqual({ command: '' });
    });

    it('ignores extra fields gracefully', () => {
      const stdin = JSON.stringify({
        session_id: 'x',
        tool_input: { command: 'ls' },
        mcp_context: { server: 'test' },
        original_request_name: 'run_shell_command',
      });
      const result = adapter.parseHookInput(stdin);
      expect(result).toEqual({ command: 'ls', sessionId: 'x' });
    });
  });

  describe('formatHookOutput', () => {
    it('returns empty string for passthrough', () => {
      const result = adapter.formatHookOutput({ action: 'passthrough' });
      expect(result).toBe('');
    });

    it('formats rewrite with decision and tool_input', () => {
      const result = adapter.formatHookOutput({
        action: 'rewrite',
        rewrittenCommand: 'agent-term start --name pnpm-dev -- pnpm dev',
        systemMessage: "Command routed to shared terminal 'pnpm-dev' via agent-term.",
      });
      const parsed = JSON.parse(result);
      expect(parsed.decision).toBe('allow');
      expect(parsed.hookSpecificOutput.tool_input.command).toBe(
        'agent-term start --name pnpm-dev -- pnpm dev',
      );
      expect(parsed.systemMessage).toContain('pnpm-dev');
    });

    it('defaults systemMessage to empty string when omitted', () => {
      const result = adapter.formatHookOutput({
        action: 'rewrite',
        rewrittenCommand: 'agent-term logs my-server --lines 50',
      });
      const parsed = JSON.parse(result);
      expect(parsed.systemMessage).toBe('');
      expect(parsed.hookSpecificOutput.tool_input.command).toBe(
        'agent-term logs my-server --lines 50',
      );
    });
  });

  describe('register', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('creates settings with hook when file does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      adapter.register();

      expect(writeFileSync).toHaveBeenCalledOnce();
      const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string);
      expect(written.hooks.BeforeTool).toHaveLength(1);
      expect(written.hooks.BeforeTool[0].matcher).toBe('run_shell_command');
      expect(written.hooks.BeforeTool[0].hooks[0].name).toBe('agent-term');
      expect(written.hooks.BeforeTool[0].hooks[0].command).toBe('agent-term hook --agent gemini-cli');
      expect(written.hooks.BeforeTool[0].hooks[0].timeout).toBe(15000);
    });

    it('merges with existing settings without clobbering', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        mcpServers: { test: {} },
        hooks: {
          SessionStart: [{ hooks: [{ type: 'command', command: 'echo hi' }] }],
        },
      }));

      adapter.register();

      const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string);
      expect(written.mcpServers).toEqual({ test: {} });
      expect(written.hooks.SessionStart).toHaveLength(1);
      expect(written.hooks.BeforeTool).toHaveLength(1);
    });

    it('skips write when already registered', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        hooks: {
          BeforeTool: [{
            matcher: 'run_shell_command',
            hooks: [{ name: 'agent-term', type: 'command', command: 'agent-term hook --agent gemini-cli', timeout: 15000 }],
          }],
        },
      }));

      adapter.register();

      expect(writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('unregister', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('removes agent-term hook by name', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        hooks: {
          BeforeTool: [
            { matcher: 'run_shell_command', hooks: [{ name: 'agent-term', type: 'command', command: 'agent-term hook --agent gemini-cli' }] },
            { matcher: 'write_file', hooks: [{ type: 'command', command: 'lint-check.sh' }] },
          ],
        },
      }));

      adapter.unregister();

      const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string);
      expect(written.hooks.BeforeTool).toHaveLength(1);
      expect(written.hooks.BeforeTool[0].matcher).toBe('write_file');
    });

    it('handles missing hooks gracefully', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ mcpServers: {} }));

      adapter.unregister();

      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it('removes hook by command fallback when name is absent', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        hooks: {
          BeforeTool: [
            { matcher: 'run_shell_command', hooks: [{ type: 'command', command: 'agent-term hook --agent gemini-cli' }] },
          ],
        },
      }));

      adapter.unregister();

      const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string);
      expect(written.hooks.BeforeTool).toBeUndefined();
    });

    it('removes BeforeTool key when array becomes empty', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        hooks: {
          BeforeTool: [
            { matcher: 'run_shell_command', hooks: [{ name: 'agent-term', command: 'agent-term hook --agent gemini-cli' }] },
          ],
          SessionStart: [{ hooks: [{ command: 'other.sh' }] }],
        },
      }));

      adapter.unregister();

      const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string);
      expect(written.hooks.BeforeTool).toBeUndefined();
      expect(written.hooks.SessionStart).toHaveLength(1);
    });
  });
});
