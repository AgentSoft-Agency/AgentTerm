import { getAdapter } from '../adapters/registry.js';
import { loadPatterns, matchCommand } from '../config.js';
import { autoName, toSessionName } from '../naming.js';
import { sessionExists } from '../tmux.js';
import type { HookResult } from '../adapters/adapter.js';

/**
 * Core hook logic: match command against patterns, decide action.
 * Separated from I/O for testability.
 */
export function processHook(command: string): HookResult {
  const patterns = loadPatterns();

  if (!matchCommand(command, patterns)) {
    return { action: 'passthrough' };
  }

  const baseName = autoName(command);
  const tmuxSessionName = toSessionName(baseName);

  if (sessionExists(tmuxSessionName)) {
    return {
      action: 'rewrite',
      rewrittenCommand: `agent-term logs ${baseName} --lines 50`,
      systemMessage: `Terminal '${baseName}' is already running. Showing recent logs.`,
    };
  }

  return {
    action: 'rewrite',
    rewrittenCommand: `agent-term start --name ${baseName} -- ${command}`,
    systemMessage: `Command routed to shared terminal '${baseName}' via agent-term.`,
  };
}

/**
 * Full hook entry point: reads stdin, dispatches to adapter, runs core logic,
 * formats output, writes to stdout.
 */
export async function runHook(agentName: string): Promise<void> {
  const adapter = getAdapter(agentName);
  if (!adapter) {
    process.stderr.write(`Warning: unknown agent '${agentName}', passing through.\n`);
    process.exit(0);
  }

  let stdin = '';
  for await (const chunk of process.stdin) {
    stdin += chunk;
  }

  let input;
  try {
    input = adapter.parseHookInput(stdin);
  } catch {
    // Can't parse → pass through
    process.exit(0);
  }

  if (!input.command) {
    process.exit(0);
  }

  const result = processHook(input.command);
  const output = adapter.formatHookOutput(result);

  if (output) {
    process.stdout.write(output);
  }

  process.exit(0);
}
