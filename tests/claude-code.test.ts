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

    it('formats rewrite with updatedInput and hookEventName', () => {
      const result = adapter.formatHookOutput({
        action: 'rewrite',
        rewrittenCommand: 'agent-term start --name pnpm-dev -- pnpm dev',
        systemMessage: "Command routed to shared terminal 'pnpm-dev' via agent-term.",
      });
      const parsed = JSON.parse(result);
      expect(parsed.hookSpecificOutput.hookEventName).toBe('PreToolUse');
      expect(parsed.hookSpecificOutput.permissionDecision).toBe('allow');
      expect(parsed.hookSpecificOutput.updatedInput.command).toBe(
        'agent-term start --name pnpm-dev -- pnpm dev',
      );
      expect(parsed.hookSpecificOutput.permissionDecisionReason).toContain('pnpm-dev');
      expect(parsed.systemMessage).toBeUndefined();
    });

    it('formats output action with temp file cat command', () => {
      const result = adapter.formatHookOutput({
        action: 'output',
        stdout: 'hello world\nline 2',
        systemMessage: 'Command completed.',
      });
      const parsed = JSON.parse(result);
      expect(parsed.hookSpecificOutput.hookEventName).toBe('PreToolUse');
      expect(parsed.hookSpecificOutput.permissionDecision).toBe('allow');
      expect(parsed.hookSpecificOutput.updatedInput.command).toMatch(/^cat .*agent-term-.*\.out$/);
      expect(parsed.hookSpecificOutput.permissionDecisionReason).toBe('Command completed.');
      expect(parsed.systemMessage).toBeUndefined();
    });
  });

  describe('isSessionStart', () => {
    it('returns true for SessionStart event', () => {
      const stdin = JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup' });
      expect(adapter.isSessionStart(stdin)).toBe(true);
    });

    it('returns false for PreToolUse event', () => {
      const stdin = JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' } });
      expect(adapter.isSessionStart(stdin)).toBe(false);
    });

    it('returns false for malformed JSON', () => {
      expect(adapter.isSessionStart('not json')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(adapter.isSessionStart('')).toBe(false);
    });
  });

  describe('generateContext', () => {
    it('returns context text containing agent-term', () => {
      const context = adapter.generateContext();
      expect(context).toContain('agent-term');
      expect(context).toContain('Shared Terminal Manager');
    });
  });
});
