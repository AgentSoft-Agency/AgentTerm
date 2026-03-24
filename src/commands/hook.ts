import { getAdapter } from '../adapters/registry.js';
import { autoName, toSessionName, uniqueSuffix } from '../naming.js';
import {
  createSessionWithRemainOnExit,
  getSessionStatus,
  capturePane,
  killSession,
  setRemainOnExit,
} from '../tmux.js';
import type { HookResult } from '../adapters/adapter.js';

const HOOK_DEADLINE_MS = 13000;
const POLL_INTERVAL_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Core hook logic: route every command through tmux.
 * - agent-term commands pass through (prevents recursion)
 * - Empty commands pass through
 * - All other commands run in tmux; poll for exit or deadline
 */
export async function processHook(command: string, deadlineMs: number = HOOK_DEADLINE_MS): Promise<HookResult> {
  const trimmed = command.trim();

  // Self-check: prevent infinite recursion and skip tmux commands
  // (agent-term uses tmux internally; routing tmux through tmux would break)
  if (!trimmed || trimmed.startsWith('agent-term') || /(?:^|\/)tmux\b/.test(trimmed)) {
    return { action: 'passthrough' };
  }

  const baseName = autoName(trimmed);
  const suffix = uniqueSuffix();
  const userFacingName = `${baseName}-${suffix}`;
  const sessionName = toSessionName(userFacingName);

  // Create tmux session with remain-on-exit
  const created = createSessionWithRemainOnExit(sessionName, trimmed);
  if (!created) {
    // tmux failure — fall back to passthrough
    return { action: 'passthrough' };
  }

  const deadline = Date.now() + deadlineMs;

  // Poll loop
  while (Date.now() < deadline) {
    const status = getSessionStatus(sessionName);

    if (status.dead) {
      // Process finished — capture output and clean up
      const output = capturePane(sessionName, 5000);
      killSession(sessionName);
      return {
        action: 'output',
        stdout: output,
        systemMessage: `Command completed (exit ${status.exitCode}).`,
      };
    }

    await sleep(POLL_INTERVAL_MS);
  }

  // Deadline reached — process still running
  const logs = capturePane(sessionName, 50);
  setRemainOnExit(sessionName, false);

  return {
    action: 'rewrite',
    rewrittenCommand: `agent-term logs ${userFacingName} --lines 50`,
    systemMessage: `Terminal '${userFacingName}' is still running. Showing recent logs. Use 'agent-term logs ${userFacingName}' to check later.`,
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

  // SessionStart hooks inject context about agent-term into the conversation.
  if (adapter.isSessionStart(stdin)) {
    const context = adapter.generateContext();
    if (context) {
      process.stdout.write(context);
    }
    process.exit(0);
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

  const result = await processHook(input.command);
  const output = adapter.formatHookOutput(result);

  if (output) {
    process.stdout.write(output);
  }

  process.exit(0);
}
