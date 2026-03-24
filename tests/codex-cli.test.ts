import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { CodexCliAdapter } from '../src/adapters/codex-cli.js';

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

vi.mock('../src/tmux.js', () => ({
  listSessionNames: vi.fn(() => []),
  getSessionStatus: vi.fn(() => ({ pid: '1234', dead: false, exitCode: '' })),
  getSessionCommand: vi.fn(() => 'pnpm dev'),
}));

import { listSessionNames, getSessionStatus, getSessionCommand } from '../src/tmux.js';

describe('CodexCliAdapter', () => {
  const adapter = new CodexCliAdapter();

  it('has correct metadata', () => {
    expect(adapter.name).toBe('codex-cli');
    expect(adapter.displayName).toBe('Codex CLI');
  });

  describe('parseHookInput', () => {
    it('extracts sessionId from SessionStart stdin', () => {
      const stdin = JSON.stringify({
        session_id: 'codex-session-1',
        hook_event_name: 'SessionStart',
        cwd: '/tmp/project',
      });
      const result = adapter.parseHookInput(stdin);
      expect(result).toEqual({ command: '', sessionId: 'codex-session-1' });
    });

    it('returns empty command for any input (context mode)', () => {
      const stdin = JSON.stringify({
        session_id: 'abc',
        tool_input: { command: 'pnpm dev' },
      });
      const result = adapter.parseHookInput(stdin);
      expect(result.command).toBe('');
    });

    it('handles malformed JSON', () => {
      const result = adapter.parseHookInput('not json {{{');
      expect(result).toEqual({ command: '' });
    });

    it('handles empty string', () => {
      const result = adapter.parseHookInput('');
      expect(result).toEqual({ command: '' });
    });
  });

  describe('formatHookOutput', () => {
    it('always returns empty string (context mode)', () => {
      expect(adapter.formatHookOutput({ action: 'passthrough' })).toBe('');
      expect(adapter.formatHookOutput({
        action: 'rewrite',
        rewrittenCommand: 'agent-term start -- pnpm dev',
      })).toBe('');
    });
  });

  describe('isSessionStart', () => {
    it('always returns true (context-mode adapter)', () => {
      expect(adapter.isSessionStart('')).toBe(true);
      expect(adapter.isSessionStart('{"hook_event_name":"SessionStart"}')).toBe(true);
      expect(adapter.isSessionStart('anything')).toBe(true);
    });
  });

  describe('generateContext', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('generates context with no active terminals', () => {
      vi.mocked(listSessionNames).mockReturnValue([]);

      const context = adapter.generateContext();
      expect(context).toContain('Shared Terminal Manager');
      expect(context).toContain('agent-term start');
      expect(context).toContain('agent-term logs');
    });

    it('lists active terminals', () => {
      vi.mocked(listSessionNames).mockReturnValue(['at-pnpm-dev', 'at-docker-compose-up']);
      vi.mocked(getSessionStatus)
        .mockReturnValueOnce({ pid: '1234', dead: false, exitCode: '' })
        .mockReturnValueOnce({ pid: '5678', dead: true, exitCode: '1' });
      vi.mocked(getSessionCommand)
        .mockReturnValueOnce('pnpm dev')
        .mockReturnValueOnce('docker compose up');

      const context = adapter.generateContext();
      expect(context).toContain('pnpm-dev (running)');
      expect(context).toContain('docker-compose-up (exited)');
      expect(context).toContain('agent-term logs pnpm-dev');
    });

    it('includes usage commands', () => {
      vi.mocked(listSessionNames).mockReturnValue([]);

      const context = adapter.generateContext();
      expect(context).toContain('agent-term start');
      expect(context).toContain('agent-term logs');
      expect(context).toContain('agent-term send');
      expect(context).toContain('agent-term kill');
    });

    it('handles tmux errors gracefully', () => {
      vi.mocked(listSessionNames).mockImplementation(() => { throw new Error('tmux not running'); });

      const context = adapter.generateContext();
      expect(context).toContain('agent-term');
      expect(context).not.toContain('Active terminals');
    });
  });

  describe('register', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('appends hook block to empty config', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      adapter.register();

      expect(writeFileSync).toHaveBeenCalledOnce();
      const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
      expect(written).toContain('[[hooks]]');
      expect(written).toContain('event = "SessionStart"');
      expect(written).toContain('agent-term hook --agent codex-cli');
    });

    it('appends hook block to existing config with mcp_servers', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('[mcp_servers]\n');

      adapter.register();

      expect(writeFileSync).toHaveBeenCalledOnce();
      const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
      expect(written).toContain('[mcp_servers]');
      expect(written).toContain('[[hooks]]');
      expect(written).toContain('event = "SessionStart"');
    });

    it('skips write when already registered', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        '[mcp_servers]\n\n# agent-term hook\n[[hooks]]\nevent = "SessionStart"\ncommand = "agent-term hook --agent codex-cli"\n',
      );

      adapter.register();

      expect(writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('unregister', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('removes agent-term hook block', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        '[mcp_servers]\n\n# agent-term hook\n[[hooks]]\nevent = "SessionStart"\ncommand = "agent-term hook --agent codex-cli"\n',
      );

      adapter.unregister();

      expect(writeFileSync).toHaveBeenCalledOnce();
      const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
      expect(written).toContain('[mcp_servers]');
      expect(written).not.toContain('agent-term');
      expect(written).not.toContain('[[hooks]]');
    });

    it('preserves other hooks when removing agent-term', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        '[[hooks]]\nevent = "Stop"\ncommand = "notify-send done"\n\n# agent-term hook\n[[hooks]]\nevent = "SessionStart"\ncommand = "agent-term hook --agent codex-cli"\n',
      );

      adapter.unregister();

      const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
      expect(written).toContain('event = "Stop"');
      expect(written).toContain('notify-send done');
      expect(written).not.toContain('agent-term');
    });

    it('does nothing when agent-term is not registered', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('[mcp_servers]\n');

      adapter.unregister();

      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it('handles missing config file', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      adapter.unregister();

      expect(writeFileSync).not.toHaveBeenCalled();
    });
  });
});
