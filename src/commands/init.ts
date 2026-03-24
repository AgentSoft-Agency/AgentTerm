import { intro, outro, multiselect, note, isCancel, cancel } from '@clack/prompts';
import { isTmuxInstalled } from '../tmux.js';
import { getAllAdapters, detectInstalledAgents } from '../adapters/registry.js';

export async function runInit(options: { nonInteractive?: boolean; agents?: string }): Promise<void> {
  if (options.nonInteractive) {
    return runNonInteractive(options.agents);
  }

  intro('agent-term init');

  // Step 1: Check tmux
  if (!isTmuxInstalled()) {
    const platform = process.platform;
    const installCmd = platform === 'darwin'
      ? 'brew install tmux'
      : 'sudo apt install tmux';
    note(`tmux is required but not installed.\n\nInstall it with:\n  ${installCmd}`, 'Missing dependency');
    process.exit(1);
  }

  // Step 2: Detect agents
  const allAdapters = getAllAdapters();
  const detected = detectInstalledAgents();

  if (allAdapters.length === 0) {
    note('No agent adapters available.', 'Agents');
    outro('Setup complete.');
    return;
  }

  const options_list = allAdapters.map((a) => ({
    value: a.name,
    label: `${a.displayName}${detected.some((d) => d.name === a.name) ? '' : ' (not detected)'}`,
    hint: a.configPath,
  }));

  const selected = await multiselect({
    message: `Found ${detected.length} agent(s) installed. Select which to configure:`,
    options: options_list,
    initialValues: detected.map((a) => a.name),
    required: false,
  });

  if (isCancel(selected)) { cancel('Setup cancelled.'); process.exit(0); }

  // Step 3: Register hooks
  const selectedAdapters = allAdapters.filter((a) => (selected as string[]).includes(a.name));

  for (const adapter of selectedAdapters) {
    adapter.register();
    note(`Registered hook in ${adapter.configPath}`, adapter.displayName);
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
        adapter.register();
        console.log(`Registered hook for ${adapter.displayName}`);
      } else {
        console.warn(`Warning: unknown agent '${name}'`);
      }
    }
  }

  console.log('agent-term setup complete.');
}
