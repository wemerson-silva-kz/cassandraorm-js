import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function initCommand(options: any) {
  console.log(chalk.blue('\n🚀 Initializing new CassandraORM project...\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: 'my-cassandra-app'
    },
    {
      type: 'confirm',
      name: 'typescript',
      message: 'Use TypeScript?',
      default: true
    },
    {
      type: 'checkbox',
      name: 'features',
      message: 'Select features to include:',
      choices: [
        { name: 'AI/ML Integration', value: 'ai' },
        { name: 'Real-time Subscriptions', value: 'realtime' },
        { name: 'Event Sourcing', value: 'events' },
        { name: 'GraphQL Integration', value: 'graphql' },
        { name: 'Web Dashboard', value: 'dashboard' }
      ]
    }
  ]);

  const spinner = ora('Creating project structure...').start();

  try {
    // Create project directory
    await mkdir(answers.projectName, { recursive: true });
    
    // Create package.json
    const packageJson = {
      name: answers.projectName,
      version: '1.0.0',
      description: 'CassandraORM application',
      main: answers.typescript ? 'dist/index.js' : 'index.js',
      scripts: {
        start: answers.typescript ? 'node dist/index.js' : 'node index.js',
        dev: answers.typescript ? 'ts-node src/index.ts' : 'node index.js',
        build: answers.typescript ? 'tsc' : 'echo "No build needed"',
        test: 'jest'
      },
      dependencies: {
        'cassandraorm-js': '^1.0.0'
      },
      devDependencies: answers.typescript ? {
        'typescript': '^5.0.0',
        'ts-node': '^10.9.0',
        '@types/node': '^20.0.0'
      } : {}
    };

    await writeFile(
      join(answers.projectName, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create main file
    const mainFile = answers.typescript ? `
import { createClient } from 'cassandraorm-js';

async function main() {
  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: '${answers.projectName.replace(/-/g, '_')}'
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe'
    }
  });

  await client.connect();
  console.log('🚀 Connected to Cassandra!');
  
  // Your code here
  
  await client.shutdown();
}

main().catch(console.error);
` : `
const { createClient } = require('cassandraorm-js');

async function main() {
  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: '${answers.projectName.replace(/-/g, '_')}'
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe'
    }
  });

  await client.connect();
  console.log('🚀 Connected to Cassandra!');
  
  // Your code here
  
  await client.shutdown();
}

main().catch(console.error);
`;

    const fileName = answers.typescript ? 'src/index.ts' : 'index.js';
    if (answers.typescript) {
      await mkdir(join(answers.projectName, 'src'), { recursive: true });
    }
    
    await writeFile(join(answers.projectName, fileName), mainFile);

    // Create TypeScript config if needed
    if (answers.typescript) {
      const tsConfig = {
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          outDir: './dist',
          rootDir: './src',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist']
      };

      await writeFile(
        join(answers.projectName, 'tsconfig.json'),
        JSON.stringify(tsConfig, null, 2)
      );
    }

    spinner.succeed(chalk.green('Project created successfully!'));

    console.log(chalk.yellow(`
📁 Project created: ${answers.projectName}

🚀 Next steps:
  cd ${answers.projectName}
  npm install
  ${answers.typescript ? 'npm run dev' : 'npm start'}

🎯 Features included: ${answers.features.join(', ') || 'Basic setup'}
    `));

  } catch (error) {
    spinner.fail(chalk.red('Failed to create project'));
    console.error(error);
  }
}
