import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('bundled SKILL.md', () => {
  const assetPath = resolve(__dirname, '../src/assets/SKILL.md');
  const content = readFileSync(assetPath, 'utf-8');

  it('exists and is non-empty', () => {
    expect(content.length).toBeGreaterThan(0);
  });

  it('has YAML frontmatter with name and description', () => {
    expect(content.startsWith('---\n')).toBe(true);
    expect(content).toMatch(/\nname:\s*agent-term\s*\n/);
    expect(content).toMatch(/\ndescription:\s*.+\n/);
  });

  it('description names concrete long-running triggers', () => {
    expect(content).toMatch(/dev servers?/i);
    expect(content).toMatch(/watcher/i);
    expect(content).toMatch(/tail -f/);
    expect(content).toMatch(/daemon|tunnel/i);
  });

  it('description includes negative examples', () => {
    expect(content).toMatch(/DO NOT use for|not for|Do not use/);
    expect(content).toMatch(/build|test|install/i);
  });

  it('body teaches list-before-start discipline', () => {
    expect(content).toContain('agent-term list');
    expect(content).toContain('agent-term start');
  });
});
