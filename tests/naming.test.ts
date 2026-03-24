import { describe, it, expect } from 'vitest';
import { autoName } from '../src/naming.js';
import { uniqueSuffix } from '../src/naming.js';

describe('autoName', () => {
  it('converts simple commands to kebab-case', () => {
    expect(autoName('pnpm dev')).toBe('pnpm-dev');
  });

  it('handles multi-word commands', () => {
    expect(autoName('docker compose up')).toBe('docker-compose-up');
  });

  it('strips flags', () => {
    expect(autoName('pnpm dev --port 3000')).toBe('pnpm-dev');
  });

  it('handles paths in commands', () => {
    expect(autoName('node ./server.js')).toBe('node-server.js');
  });

  it('limits length', () => {
    const long = 'some very long command with many words that goes on forever';
    expect(autoName(long).length).toBeLessThanOrEqual(30);
  });

  it('handles npm run scripts', () => {
    expect(autoName('npm run dev')).toBe('npm-run-dev');
  });

  it('strips leading path components', () => {
    expect(autoName('/usr/bin/node server.js')).toBe('node-server.js');
  });
});

describe('uniqueSuffix', () => {
  it('returns a 4-character hex string', () => {
    const suffix = uniqueSuffix();
    expect(suffix).toMatch(/^[0-9a-f]{4}$/);
  });

  it('returns different values on successive calls', () => {
    const a = uniqueSuffix();
    const b = uniqueSuffix();
    expect(a).not.toBe(b);
  });
});
