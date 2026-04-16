export interface AgentAdapter {
  name: string;
  displayName: string;
  /** Absolute path to the directory where SKILL.md is installed. */
  skillPath: string;
  /** Absolute path to the agent's legacy config file (used only for hook migration). */
  configPath: string;
  detect(): boolean;
  /** Copies the bundled SKILL.md into skillPath. Idempotent. */
  installSkill(): void;
  /** Removes the installed skill directory. Idempotent. */
  uninstallSkill(): void;
  /** Strips legacy agent-term hooks from the agent's config. Returns whether anything was removed. */
  removeLegacyHooks(): { removed: boolean };
}
