import { describe, it, expect, vi } from 'vitest';
import { buildContextText } from '../src/adapters/context.js';

vi.mock('../src/tmux.js', () => ({
  listSessionNames: vi.fn(() => []),
  getSessionStatus: vi.fn(() => ({ pid: '1234', dead: false, exitCode: '' })),
  getSessionCommand: vi.fn(() => 'pnpm dev'),
}));

import { listSessionNames, getSessionStatus, getSessionCommand } from '../src/tmux.js';

describe('buildContextText', () => {
  it('includes header about agent-term', () => {
    const text = buildContextText();
    expect(text).toContain('agent-term');
    expect(text).toContain('shared tmux terminals');
  });

  it('shows no active terminals when none exist', () => {
    vi.mocked(listSessionNames).mockReturnValue([]);
    const text = buildContextText();
    expect(text).toContain('No active shared terminals');
  });

  it('lists active terminals', () => {
    vi.mocked(listSessionNames).mockReturnValue(['at-pnpm-dev', 'at-docker-up']);
    vi.mocked(getSessionStatus)
      .mockReturnValueOnce({ pid: '1234', dead: false, exitCode: '' })
      .mockReturnValueOnce({ pid: '5678', dead: true, exitCode: '0' });
    vi.mocked(getSessionCommand)
      .mockReturnValueOnce('pnpm dev')
      .mockReturnValueOnce('docker compose up');

    const text = buildContextText();
    expect(text).toContain('pnpm-dev');
    expect(text).toContain('running');
    expect(text).toContain('docker-up');
    expect(text).toContain('exited');
  });

  it('includes usage instructions', () => {
    const text = buildContextText();
    expect(text).toContain('agent-term start');
    expect(text).toContain('agent-term logs');
    expect(text).toContain('agent-term send');
    expect(text).toContain('agent-term kill');
    expect(text).toContain('agent-term list');
    expect(text).toContain('Do NOT run long-running commands directly');
  });

  it('handles tmux errors gracefully', () => {
    vi.mocked(listSessionNames).mockImplementation(() => { throw new Error('tmux not running'); });
    const text = buildContextText();
    expect(text).toContain('No active shared terminals');
  });
});
