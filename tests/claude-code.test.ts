import { describe, it, expect } from 'vitest';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.js';

describe('ClaudeCodeAdapter', () => {
  const adapter = new ClaudeCodeAdapter();

  describe('parseHookInput', () => {
    it('extracts command and sessionId from Claude Code stdin', () => {
      const stdin = JSON.stringify({
        session_id: 'abc123',
        tool_input: { command: 'pnpm dev' },
        tool_name: 'Bash',
      });
      const result = adapter.parseHookInput(stdin);
      expect(result).toEqual({ command: 'pnpm dev', sessionId: 'abc123' });
    });

    it('handles missing session_id', () => {
      const stdin = JSON.stringify({
        tool_input: { command: 'git status' },
      });
      const result = adapter.parseHookInput(stdin);
      expect(result).toEqual({ command: 'git status', sessionId: undefined });
    });
  });

  describe('formatHookOutput', () => {
    it('returns empty string for passthrough', () => {
      const result = adapter.formatHookOutput({ action: 'passthrough' });
      expect(result).toBe('');
    });

    it('formats rewrite with updatedInput', () => {
      const result = adapter.formatHookOutput({
        action: 'rewrite',
        rewrittenCommand: 'agent-term start --name pnpm-dev -- pnpm dev',
        systemMessage: "Command routed to shared terminal 'pnpm-dev' via agent-term.",
      });
      const parsed = JSON.parse(result);
      expect(parsed.hookSpecificOutput.permissionDecision).toBe('allow');
      expect(parsed.hookSpecificOutput.updatedInput.command).toBe(
        'agent-term start --name pnpm-dev -- pnpm dev',
      );
      expect(parsed.systemMessage).toContain('pnpm-dev');
    });

    it('formats output action with temp file cat command', () => {
      const result = adapter.formatHookOutput({
        action: 'output',
        stdout: 'hello world\nline 2',
        systemMessage: 'Command completed.',
      });
      const parsed = JSON.parse(result);
      expect(parsed.hookSpecificOutput.permissionDecision).toBe('allow');
      expect(parsed.hookSpecificOutput.updatedInput.command).toMatch(/^cat .*agent-term-.*\.out$/);
      expect(parsed.systemMessage).toBe('Command completed.');
    });
  });
});
