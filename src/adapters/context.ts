import { listSessionNames, getSessionStatus, getSessionCommand } from '../tmux.js';
import { fromSessionName } from '../naming.js';

/**
 * Build context text describing agent-term availability and active terminals.
 * Used by all adapters' generateContext() for SessionStart injection.
 */
export function buildContextText(): string {
  const sections: string[] = [];

  sections.push('## agent-term: Shared Terminal Manager');
  sections.push('');
  sections.push('All Bash commands are managed by `agent-term`. To check process output, logs, or status, ONLY use `agent-term` commands. Do NOT use `lsof`, `ps aux`, `tmux`, `docker logs`, or other tools to find process output.');
  sections.push('');

  try {
    const sessions = listSessionNames();
    if (sessions.length > 0) {
      sections.push('Active terminals:');
      for (const sn of sessions) {
        const name = fromSessionName(sn);
        const { dead } = getSessionStatus(sn);
        const status = dead ? 'exited' : 'running';
        sections.push(`- ${name} (${status}) → use \`agent-term logs ${name}\` to read output`);
      }
      sections.push('');
    }
  } catch {
    // tmux not running — skip terminal listing
  }

  sections.push('Commands:');
  sections.push('- `agent-term list` — show all terminals');
  sections.push('- `agent-term logs <name>` — read terminal output');
  sections.push('- `agent-term logs <name> --lines 500` — read more output');
  sections.push('- `agent-term send <name> "<input>"` — send input (e.g. "rs" to restart)');
  sections.push('- `agent-term status <name>` — check if process is alive');
  sections.push('- `agent-term kill <name>` — stop a terminal');
  sections.push('- `agent-term start --name <name> -- <command>` — start a new long-running process');

  return sections.join('\n');
}
