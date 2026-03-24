#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('agent-term')
  .description('Shared long-running terminals for AI coding agents')
  .version('0.1.0');

program
  .command('init')
  .description('Set up agent-term: create config, detect and register agent hooks')
  .option('--non-interactive', 'Run without prompts')
  .option('--agents <names>', 'Comma-separated agent names (for non-interactive mode)')
  .action(async (opts) => {
    const { runInit } = await import('./commands/init.js');
    await runInit({ nonInteractive: opts.nonInteractive, agents: opts.agents });
  });

program
  .command('hook')
  .description('Agent pre-hook entry point (called by agents, not users)')
  .requiredOption('--agent <name>', 'Agent adapter name')
  .action(async (opts) => {
    const { runHook } = await import('./commands/hook.js');
    await runHook(opts.agent);
  });

program
  .command('start')
  .description('Start a shared terminal')
  .option('--name <name>', 'Terminal name (auto-generated from command if omitted)')
  .argument('<command...>', 'Command to run')
  .action(async (args, opts) => {
    const { runStart } = await import('./commands/start.js');
    runStart(args, opts.name);
  });

program
  .command('logs')
  .description('Show terminal output')
  .argument('<name>', 'Terminal name')
  .option('--lines <n>', 'Number of lines', '100')
  .action(async (name, opts) => {
    const { runLogs } = await import('./commands/logs.js');
    runLogs(name, parseInt(opts.lines, 10));
  });

program
  .command('send')
  .description('Send input to a terminal')
  .argument('<name>', 'Terminal name')
  .argument('<input>', 'Text or keys to send')
  .action(async (name, input) => {
    const { runSend } = await import('./commands/send.js');
    runSend(name, input);
  });

program
  .command('kill')
  .description('Kill a shared terminal')
  .argument('<name>', 'Terminal name')
  .action(async (name) => {
    const { runKill } = await import('./commands/kill.js');
    runKill(name);
  });

program
  .command('restart')
  .description('Restart a shared terminal (kill and re-run same command)')
  .argument('<name>', 'Terminal name')
  .action(async (name) => {
    const { runRestart } = await import('./commands/restart.js');
    runRestart(name);
  });

program
  .command('status')
  .description('Show terminal status')
  .argument('<name>', 'Terminal name')
  .action(async (name) => {
    const { runStatus } = await import('./commands/status.js');
    runStatus(name);
  });

program
  .command('list')
  .description('List active terminals')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const { runList } = await import('./commands/list.js');
    runList(opts.json ?? false);
  });

program.parse();
