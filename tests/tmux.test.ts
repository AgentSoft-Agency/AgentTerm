import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildTmuxArgs, parseTmuxList } from '../src/tmux.js';

describe('buildTmuxArgs', () => {
  it('uses the agent-term server', () => {
    const args = buildTmuxArgs(['list-sessions']);
    expect(args).toEqual(['-L', 'agent-term', 'list-sessions']);
  });

  it('passes through additional args', () => {
    const args = buildTmuxArgs(['new-session', '-d', '-s', 'at-test']);
    expect(args).toEqual(['-L', 'agent-term', 'new-session', '-d', '-s', 'at-test']);
  });
});

describe('parseTmuxList', () => {
  it('parses -F #{session_name} output (one name per line)', () => {
    const output = 'at-pnpm-dev\nat-docker-up';
    const sessions = parseTmuxList(output);
    expect(sessions).toEqual(['at-pnpm-dev', 'at-docker-up']);
  });

  it('returns empty array for empty output', () => {
    expect(parseTmuxList('')).toEqual([]);
  });

  it('handles "no server running" error gracefully', () => {
    expect(parseTmuxList('no server running on /tmp/tmux-501/agent-term')).toEqual([]);
  });
});
