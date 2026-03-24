import { describe, it, expect } from 'vitest';
import { GeminiCliAdapter } from '../src/adapters/gemini-cli.js';

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
});
