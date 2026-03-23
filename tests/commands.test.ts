import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock tmux module
vi.mock('../src/tmux.js', () => ({
  sessionExists: vi.fn(() => false),
  capturePane: vi.fn(() => 'some output'),
  createSession: vi.fn(),
  sendKeys: vi.fn(),
  killSession: vi.fn(),
  getSessionStatus: vi.fn(() => ({ pid: '12345', dead: false, exitCode: '' })),
  getSessionCommand: vi.fn(() => 'pnpm dev'),
  getSessionCreated: vi.fn(() => Math.floor(Date.now() / 1000) - 60),
  listSessionNames: vi.fn(() => ['at-pnpm-dev']),
}));

import { sessionExists, capturePane, createSession, killSession, listSessionNames } from '../src/tmux.js';
import { runLogs } from '../src/commands/logs.js';
import { runKill } from '../src/commands/kill.js';

describe('logs command', () => {
  beforeEach(() => vi.clearAllMocks());

  it('prints output when session exists', () => {
    vi.mocked(sessionExists).mockReturnValue(true);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    runLogs('pnpm-dev', 100);
    expect(capturePane).toHaveBeenCalledWith('at-pnpm-dev', 100);
    spy.mockRestore();
  });

  it('exits with error when session not found', () => {
    vi.mocked(sessionExists).mockReturnValue(false);
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => runLogs('nonexistent', 100)).toThrow('exit');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('not found'));
    mockExit.mockRestore();
    spy.mockRestore();
  });
});

describe('kill command', () => {
  beforeEach(() => vi.clearAllMocks());

  it('kills session when it exists', () => {
    vi.mocked(sessionExists).mockReturnValue(true);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    runKill('pnpm-dev');
    expect(killSession).toHaveBeenCalledWith('at-pnpm-dev');
    spy.mockRestore();
  });
});
