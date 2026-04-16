import { intro, outro, multiselect, note, isCancel, cancel } from '@clack/prompts';
import { isTmuxInstalled } from '../tmux.js';
import { getAllAdapters, detectInstalledAgents } from '../adapters/registry.js';

export async function runInit(options: { nonInteractive?: boolean; agents?: string }): Promise<void> {
  if (options.nonInteractive) {
    return runNonInteractive(options.agents);
  }

  intro('agent-term init');

  if (!isTmuxInstalled()) {
    const platform = process.platform;
    const installCmd = platform === 'darwin' ? 'brew install tmux' : 'sudo apt install tmux';
    note(`tmux is required but not installed.\n\nInstall it with:\n  ${installCmd}`, 'Missing dependency');
    process.exit(1);
  }

  const allAdapters = getAllAdapters();
  const detected = detectInstalledAgents();

  if (allAdapters.length === 0) {
    note('No agent adapters available.', 'Agents');
    outro('Setup complete.');
    return;
  }

  const optionsList = allAdapters.map((a) => ({
    value: a.name,
    label: `${a.displayName}${detected.some((d) => d.name === a.name) ? '' : ' (not detected)'}`,
    hint: a.skillPath,
  }));

  const selected = await multiselect({
    message: `Found ${detected.length} agent(s) installed. Select which to configure:`,
    options: optionsList,
    initialValues: detected.map((a) => a.name),
    required: false,
  });

  if (isCancel(selected)) { cancel('Setup cancelled.'); process.exit(0); }

  const selectedAdapters = allAdapters.filter((a) => (selected as string[]).includes(a.name));

  for (const adapter of selectedAdapters) {
    const { removed } = adapter.removeLegacyHooks();
    if (removed) {
      note(`Removed legacy hooks from ${adapter.configPath}`, adapter.displayName);
    }
    adapter.installSkill();
    note(`Installed skill at ${adapter.skillPath}`, adapter.displayName);
  }

  outro(`agent-term configured for ${selectedAdapters.length} agent(s). Run 'agent-term list' to see shared terminals.`);
}

async function runNonInteractive(agentNames?: string): Promise<void> {
  if (!isTmuxInstalled()) {
    console.error('Error: tmux is not installed.');
    process.exit(1);
  }

  if (agentNames) {
    const names = agentNames.split(',').map((n) => n.trim());
    const allAdapters = getAllAdapters();
    for (const name of names) {
      const adapter = allAdapters.find((a) => a.name === name);
      if (adapter) {
        const { removed } = adapter.removeLegacyHooks();
        if (removed) console.log(`Removed legacy hooks for ${adapter.displayName}`);
        adapter.installSkill();
        console.log(`Installed skill for ${adapter.displayName}`);
      } else {
        console.warn(`Warning: unknown agent '${name}'`);
      }
    }
  }

  console.log('agent-term setup complete.');
}
