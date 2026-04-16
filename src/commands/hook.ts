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

/**
 * Patterns that indicate a long-running process worth managing in tmux.
 * Matches against the first "word" (binary name) of the command.
 * Everything else passes through to run normally.
 */
const LONG_RUNNING_PATTERNS: RegExp[] = [
  // Dev servers & watchers
  /\b(?:npm|pnpm|yarn|bun|npx)\s+(?:run\s+)?(?:dev|start|serve|watch|preview)\b/,
  /\b(?:node|ts-node|tsx|nodemon|vite|next|nuxt|remix|astro)\b/,
  /\b(?:python|python3|uvicorn|gunicorn|flask|django)\b.*\b(?:run|serve|manage)\b/,
  /\b(?:cargo)\s+(?:run|watch)\b/,
  /\b(?:go)\s+run\b/,
  /\b(?:ruby|rails|bundle\s+exec)\b.*\b(?:server|s)\b/,
  // Containers & infra
  /\b(?:docker|docker-compose|podman)\s+(?:compose\s+)?(?:up|run|start|exec)\b/,
  /\b(?:kubectl)\s+(?:port-forward|logs\s+-f|exec)\b/,
  // Explicit agent-term start (always route)
  /\bagent-term\s+start\b/,
  // Tail/follow logs
  /\btail\s+-[fF]\b/,
  /\b(?:journalctl|stern)\b.*-f\b/,
  // Long builds
  /\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?build\b/,
  /\b(?:make|cmake|gradle|mvn|cargo\s+build)\b/,
  // Terraform / infrastructure
  /\b(?:terraform|tofu)\s+(?:apply|plan|init)\b/,
];

/**
 * Check if a command looks like a long-running process that should be
 * managed by agent-term. Short-lived commands (git, cat, grep, ls, etc.)
 * pass through and run normally.
 */
export function isLongRunning(command: string): boolean {
  return LONG_RUNNING_PATTERNS.some((pattern) => pattern.test(command));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Core hook logic: only route long-running commands through tmux.
 * - agent-term / tmux commands pass through (prevents recursion)
 * - Empty commands pass through
 * - Short-lived commands (git, cat, grep, etc.) pass through
 * - Long-running commands (dev servers, builds, watchers) run in tmux
 */
export async function processHook(command: string, deadlineMs: number = HOOK_DEADLINE_MS): Promise<HookResult> {
  const trimmed = command.trim();

  // Self-check: prevent infinite recursion and skip tmux commands
  if (!trimmed || trimmed.startsWith('agent-term') || /(?:^|\/)tmux\b/.test(trimmed)) {
    return { action: 'passthrough' };
  }

  // Only route long-running commands through tmux
  if (!isLongRunning(trimmed)) {
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

  // Deadline reached — process still running (expected for dev servers, etc.)
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
