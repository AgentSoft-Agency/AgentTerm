export interface HookInput {
  command: string;
  sessionId?: string;
}

export interface HookResult {
  action: 'passthrough' | 'rewrite' | 'output';
  rewrittenCommand?: string;
  systemMessage?: string;
  stdout?: string;
}

export interface AgentAdapter {
  name: string;
  displayName: string;
  configPath: string;
  detect(): boolean;
  register(): void;
  unregister(): void;
  parseHookInput(stdin: string): HookInput;
  formatHookOutput(result: HookResult): string;
  /** Detect if this hook invocation is a SessionStart event from stdin JSON. */
  isSessionStart(stdin: string): boolean;
  /** Generate context text to inject at session start. */
  generateContext(): string;
}
