#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('agent-term')
  .description('Shared long-running terminals for AI coding agents')
  .version('0.1.0');

program.parse();
