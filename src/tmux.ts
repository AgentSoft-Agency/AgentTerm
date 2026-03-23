import { spawnSync, spawn, type ChildProcess } from 'node:child_process';

const TMUX_SERVER = 'agent-term';

/**
 * Build tmux args with the dedicated server flag.
 */
export function buildTmuxArgs(args: string[]): string[] {
  return ['-L', TMUX_SERVER, ...args];
}

/**
 * Run a tmux command synchronously and return stdout.
 */
export function tmuxSync(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync('tmux', buildTmuxArgs(args), {
    encoding: 'utf-8',
    timeout: 10000,
  });
  return {
    stdout: result.stdout?.trim() ?? '',
    stderr: result.stderr?.trim() ?? '',
    exitCode: result.status ?? 1,
  };
}

/**
 * Check if tmux is installed.
 */
export function isTmuxInstalled(): boolean {
  const result = spawnSync('tmux', ['-V'], { encoding: 'utf-8' });
  return result.status === 0;
}

/**
 * List all session names on the agent-term tmux server.
 */
export function listSessionNames(): string[] {
  const { stdout, exitCode } = tmuxSync(['list-sessions', '-F', '#{session_name}']);
  if (exitCode !== 0 || !stdout) return [];
  return parseTmuxList(stdout);
}

/**
 * Parse tmux list-sessions output into session names.
 */
export function parseTmuxList(output: string): string[] {
  if (!output || output.includes('no server running')) return [];
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((name) => name.length > 0);
}

/**
 * Check if a specific session exists and is running.
 */
export function sessionExists(sessionName: string): boolean {
  const { exitCode } = tmuxSync(['has-session', '-t', sessionName]);
  return exitCode === 0;
}

/**
 * Create a new tmux session running a command.
 */
export function createSession(sessionName: string, command: string): void {
  tmuxSync(['new-session', '-d', '-s', sessionName, '-x', '200', '-y', '50', command]);
}

/**
 * Capture scrollback from a tmux session.
 */
export function capturePane(sessionName: string, lines: number): string {
  const { stdout } = tmuxSync([
    'capture-pane', '-t', sessionName, '-p', '-S', `-${lines}`,
  ]);
  return stdout;
}

/**
 * Send keys to a tmux session.
 */
export function sendKeys(sessionName: string, keys: string): void {
  tmuxSync(['send-keys', '-t', sessionName, keys]);
}

/**
 * Kill a tmux session.
 */
export function killSession(sessionName: string): void {
  tmuxSync(['kill-session', '-t', sessionName]);
}

/**
 * Check if the process in a tmux session is still running.
 * Returns the pane_pid and pane_dead status.
 */
export function getSessionStatus(sessionName: string): { pid: string; dead: boolean; exitCode: string } {
  const { stdout } = tmuxSync([
    'display-message', '-t', sessionName, '-p', '#{pane_pid}:#{pane_dead}:#{pane_dead_status}',
  ]);
  const [pid = '', deadStr = '', exitCode = ''] = stdout.split(':');
  return { pid, dead: deadStr === '1', exitCode };
}

/**
 * Get the command running in a tmux session.
 */
export function getSessionCommand(sessionName: string): string {
  const { stdout } = tmuxSync([
    'display-message', '-t', sessionName, '-p', '#{pane_start_command}',
  ]);
  return stdout;
}

/**
 * Get the session creation time as an epoch timestamp.
 */
export function getSessionCreated(sessionName: string): number {
  const { stdout } = tmuxSync([
    'display-message', '-t', sessionName, '-p', '#{session_created}',
  ]);
  return parseInt(stdout, 10) || 0;
}
