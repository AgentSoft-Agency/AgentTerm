import { listSessionNames, getSessionStatus, getSessionCommand } from '../tmux.js';
import { fromSessionName } from '../naming.js';

/**
 * Build context text describing agent-term availability and active terminals.
 * Used by all adapters' generateContext() for SessionStart injection.
 */
export function buildContextText(): string {
  const sections: string[] = [];

  sections.push('## Shared Terminals (agent-term)');
  sections.push('');
  sections.push('`agent-term` is installed. All Bash commands run through shared tmux terminals automatically. Use these commands to interact with running terminals:');
  sections.push('');

  try {
    const sessions = listSessionNames();
    if (sessions.length > 0) {
      sections.push('### Active terminals');
      sections.push('');
      for (const sn of sessions) {
        const name = fromSessionName(sn);
        const { dead } = getSessionStatus(sn);
        const command = getSessionCommand(sn);
        const status = dead ? 'exited' : 'running';
        sections.push(`- **${name}** (${status}): \`${command}\``);
      }
      sections.push('');
    } else {
      sections.push('No active shared terminals.');
      sections.push('');
    }
  } catch {
    sections.push('No active shared terminals.');
    sections.push('');
  }

  sections.push('### Usage');
  sections.push('');
  sections.push('```bash');
  sections.push('# Start a long-running command in a shared terminal');
  sections.push('agent-term start --name <name> -- <command>');
  sections.push('');
  sections.push('# Read output from a shared terminal');
  sections.push('agent-term logs <name> --lines 50');
  sections.push('');
  sections.push('# Send input to a shared terminal');
  sections.push('agent-term send <name> "<input>"');
  sections.push('');
  sections.push('# Check terminal status');
  sections.push('agent-term status <name>');
  sections.push('');
  sections.push('# List all shared terminals');
  sections.push('agent-term list');
  sections.push('');
  sections.push('# Kill a shared terminal');
  sections.push('agent-term kill <name>');
  sections.push('```');
  sections.push('');
  sections.push('Do NOT run long-running commands directly — use `agent-term start` so other agent sessions can access them.');

  return sections.join('\n');
}
