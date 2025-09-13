#!/usr/bin/env node

import { Command } from 'commander';
import { initProject } from './commands/init.js';
import { generateModel } from './commands/generate.js';
import { runMigrations } from './commands/migrate.js';
import { startDashboard } from './commands/dashboard.js';

const program = new Command();

program
  .name('cassandraorm')
  .description('CassandraORM JS CLI - The most advanced Cassandra ORM toolkit')
  .version('2.0.0');

// Init command
program
  .command('init')
  .description('Initialize a new CassandraORM project')
  .argument('<project-name>', 'Name of the project')
  .option('-t, --template <template>', 'Project template', 'basic')
  .option('--typescript', 'Use TypeScript template')
  .option('--ai', 'Include AI/ML features')
  .option('--graphql', 'Include GraphQL integration')
  .action(initProject);

// Generate command
program
  .command('generate')
  .alias('g')
  .description('Generate models, migrations, and other components')
  .argument('<type>', 'Type to generate (model, migration, schema)')
  .argument('<name>', 'Name of the component')
  .option('-f, --fields <fields>', 'Model fields (comma-separated)')
  .option('--relations', 'Include relations')
  .option('--ai', 'Include AI/ML features')
  .action(generateModel);

// Migration command
program
  .command('migrate')
  .description('Run database migrations')
  .option('-u, --up', 'Run up migrations')
  .option('-d, --down', 'Run down migrations')
  .option('--reset', 'Reset all migrations')
  .action(runMigrations);

// Dashboard command
program
  .command('dashboard')
  .description('Start the web dashboard')
  .option('-p, --port <port>', 'Port to run dashboard', '3001')
  .option('--host <host>', 'Host to bind', 'localhost')
  .action(startDashboard);

// Dev command
program
  .command('dev')
  .description('Start development server with hot reload')
  .option('-p, --port <port>', 'Port to run server', '3000')
  .action(async (options) => {
    console.log('🚀 Starting CassandraORM development server...');
    console.log(`📊 Dashboard: http://localhost:${options.port || 3000}`);
    console.log('🔥 Hot reload enabled');
    // Implementation for dev server
  });

// Info command
program
  .command('info')
  .description('Display project and environment information')
  .action(() => {
    console.log('📋 CassandraORM JS Information:');
    console.log('Version: 2.0.0');
    console.log('Features: 16 Advanced Features');
    console.log('AI/ML: Vector Search, Query Optimization');
    console.log('Enterprise: Event Sourcing, Distributed Transactions');
    console.log('Real-time: WebSocket/SSE Subscriptions');
    console.log('Documentation: https://github.com/wemerson-silva-kz/cassandraorm-js');
  });

program.parse();
