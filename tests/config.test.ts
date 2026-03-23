import { describe, it, expect } from 'vitest';
import { parsePatterns, matchCommand } from '../src/config.js';

describe('parsePatterns', () => {
  it('parses lines into patterns', () => {
    const input = 'pnpm dev*\nnpm run dev*';
    expect(parsePatterns(input)).toEqual(['pnpm dev*', 'npm run dev*']);
  });

  it('ignores comments and blank lines', () => {
    const input = '# comment\n\npnpm dev*\n  \n# another\nnpm start*';
    expect(parsePatterns(input)).toEqual(['pnpm dev*', 'npm start*']);
  });

  it('trims whitespace', () => {
    const input = '  pnpm dev*  \n  npm start*  ';
    expect(parsePatterns(input)).toEqual(['pnpm dev*', 'npm start*']);
  });
});

describe('matchCommand', () => {
  const patterns = ['pnpm dev*', 'docker compose up*', 'npm run watch*'];

  it('matches exact command', () => {
    expect(matchCommand('pnpm dev', patterns)).toBe(true);
  });

  it('matches command with trailing args via wildcard', () => {
    expect(matchCommand('pnpm dev --port 3000', patterns)).toBe(true);
  });

  it('does not match unrelated commands', () => {
    expect(matchCommand('git status', patterns)).toBe(false);
  });

  it('matches docker compose', () => {
    expect(matchCommand('docker compose up -d', patterns)).toBe(true);
  });

  it('does not match partial prefix without wildcard', () => {
    expect(matchCommand('pnpm deploy', ['pnpm dev'])).toBe(false);
  });

  it('matches with wildcard at end', () => {
    expect(matchCommand('pnpm dev', ['pnpm dev*'])).toBe(true);
    expect(matchCommand('pnpm develop', ['pnpm dev*'])).toBe(true);
  });
});
