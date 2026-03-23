export interface HookInput {
  command: string;
  sessionId?: string;
}

export interface HookResult {
  action: 'passthrough' | 'rewrite';
  rewrittenCommand?: string;
  systemMessage?: string;
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
}
