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

export type HookMode = 'intercept' | 'context';

export interface AgentAdapter {
  name: string;
  displayName: string;
  configPath: string;
  /** How this adapter integrates: 'intercept' rewrites commands, 'context' injects startup context. Default: 'intercept'. */
  hookMode: HookMode;
  detect(): boolean;
  register(): void;
  unregister(): void;
  parseHookInput(stdin: string): HookInput;
  formatHookOutput(result: HookResult): string;
  /** For context-mode adapters: generate context text to inject into the model. */
  generateContext?(): string;
}
