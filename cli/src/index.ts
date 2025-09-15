#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { generateCommand } from './commands/generate.js';
import { migrateCommand } from './commands/migrate.js';
import { dashboardCommand } from './commands/dashboard.js';

const program = new Command();

program
  .name('cassandraorm')
  .description('CLI tool for CassandraORM JS - The most advanced Cassandra ORM')
  .version('1.0.0');

// ASCII Art Banner
console.log(chalk.cyan(`
╔═══════════════════════════════════════════════════════════════╗
║                    CassandraORM CLI v1.0.0                   ║
║              The Most Advanced Cassandra ORM                 ║
╚═══════════════════════════════════════════════════════════════╝
`));

// Commands
program
  .command('init')
  .description('Initialize a new CassandraORM project')
  .option('-t, --typescript', 'Use TypeScript template')
  .option('-a, --ai', 'Include AI/ML features')
  .option('-r, --realtime', 'Include real-time features')
  .action(initCommand);

program
  .command('generate')
  .alias('g')
  .description('Generate models, schemas, and boilerplate code')
  .argument('<type>', 'Type to generate (model, schema, migration)')
  .argument('<name>', 'Name of the generated item')
  .option('-f, --fields <fields>', 'Fields definition (e.g., "name:text,age:int")')
  .action(generateCommand);

program
  .command('migrate')
  .description('Run database migrations')
  .option('-u, --up', 'Run migrations up')
  .option('-d, --down', 'Run migrations down')
  .option('-s, --status', 'Show migration status')
  .action(migrateCommand);

program
  .command('dashboard')
  .description('Launch the web dashboard')
  .option('-p, --port <port>', 'Port to run dashboard on', '3000')
  .option('-o, --open', 'Open browser automatically')
  .action(dashboardCommand);

program.parse();
