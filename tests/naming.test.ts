import { describe, it, expect } from 'vitest';
import { autoName } from '../src/naming.js';

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
