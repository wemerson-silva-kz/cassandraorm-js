import { promises as fs } from 'fs';
import path from 'path';

export async function initProject(projectName: string, options: any) {
  console.log(`🚀 Initializing CassandraORM project: ${projectName}`);
  
  const projectPath = path.join(process.cwd(), projectName);
  
  try {
    // Create project directory
    await fs.mkdir(projectPath, { recursive: true });
    
    // Create basic structure
    const dirs = [
      'src/models',
      'src/migrations',
      'src/config',
      'tests',
      'docs'
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(path.join(projectPath, dir), { recursive: true });
    }
    
    // Create package.json
    const packageJson = {
      name: projectName,
      version: '1.0.0',
      description: `CassandraORM project: ${projectName}`,
      main: options.typescript ? 'src/index.ts' : 'src/index.js',
      scripts: {
        start: 'node src/index.js',
        dev: 'cassandraorm dev',
        test: 'npm test',
        migrate: 'cassandraorm migrate --up',
        dashboard: 'cassandraorm dashboard'
      },
      dependencies: {
        'cassandraorm-js': '^2.0.0',
        'cassandra-driver': '^4.7.2'
      },
      devDependencies: options.typescript ? {
        'typescript': '^5.0.0',
        '@types/node': '^20.0.0'
      } : {}
    };
    
    await fs.writeFile(
      path.join(projectPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // Create main file
    const mainFile = options.typescript ? 
      generateTypeScriptMain(options) : 
      generateJavaScriptMain(options);
    
    const extension = options.typescript ? '.ts' : '.js';
    await fs.writeFile(
      path.join(projectPath, `src/index${extension}`),
      mainFile
    );
    
    // Create config file
    const configFile = generateConfig(options);
    await fs.writeFile(
      path.join(projectPath, `src/config/database${extension}`),
      configFile
    );
    
    // Create README
    const readme = generateReadme(projectName, options);
    await fs.writeFile(
      path.join(projectPath, 'README.md'),
      readme
    );
    
    console.log('✅ Project created successfully!');
    console.log('\n📋 Next steps:');
    console.log(`   cd ${projectName}`);
    console.log('   npm install');
    console.log('   cassandraorm dev');
    console.log('\n🎉 Happy coding with CassandraORM!');
    
  } catch (error) {
    console.error('❌ Error creating project:', error);
    process.exit(1);
  }
}

function generateTypeScriptMain(options: any): string {
  return `import { createClient } from 'cassandraorm-js';
import config from './config/database.js';

async function main() {
  console.log('🚀 Starting CassandraORM application...');
  
  const client = createClient(config);
  await client.connect();
  
  console.log('✅ Connected to Cassandra');
  
  ${options.ai ? `
  // AI/ML Features
  const { AIMLManager } = await import('cassandraorm-js');
  const aiml = new AIMLManager(client.driver, config.clientOptions.keyspace);
  console.log('🧠 AI/ML features enabled');
  ` : ''}
  
  ${options.graphql ? `
  // GraphQL Integration
  const { GraphQLSchemaGenerator } = await import('cassandraorm-js');
  const generator = new GraphQLSchemaGenerator();
  console.log('🌐 GraphQL integration enabled');
  ` : ''}
  
  // Your application logic here
  
  process.on('SIGINT', async () => {
    console.log('🛑 Shutting down...');
    await client.shutdown();
    process.exit(0);
  });
}

main().catch(console.error);`;
}

function generateJavaScriptMain(options: any): string {
  return `const { createClient } = require('cassandraorm-js');
const config = require('./config/database.js');

async function main() {
  console.log('🚀 Starting CassandraORM application...');
  
  const client = createClient(config);
  await client.connect();
  
  console.log('✅ Connected to Cassandra');
  
  // Your application logic here
  
  process.on('SIGINT', async () => {
    console.log('🛑 Shutting down...');
    await client.shutdown();
    process.exit(0);
  });
}

main().catch(console.error);`;
}

function generateConfig(options: any): string {
  return `export default {
  clientOptions: {
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'myapp'
  },
  ormOptions: {
    createKeyspace: true,
    migration: 'safe',
    defaultReplicationStrategy: {
      class: 'SimpleStrategy',
      replication_factor: 1
    }
  }
};`;
}

function generateReadme(projectName: string, options: any): string {
  return `# ${projectName}

CassandraORM JS project with advanced features.

## Features

- ✅ **Modern ORM** - TypeScript-first with ES6+ support
- ✅ **Advanced Features** - 16 enterprise-grade capabilities
${options.ai ? '- ✅ **AI/ML Integration** - Vector search and query optimization' : ''}
${options.graphql ? '- ✅ **GraphQL Integration** - Auto-generated schemas' : ''}
- ✅ **Real-time** - WebSocket/SSE subscriptions
- ✅ **Event Sourcing** - CQRS pattern implementation
- ✅ **Performance** - Intelligent caching and optimization

## Quick Start

\`\`\`bash
npm install
cassandraorm dev
\`\`\`

## Commands

- \`cassandraorm dev\` - Start development server
- \`cassandraorm migrate\` - Run migrations
- \`cassandraorm dashboard\` - Open web dashboard
- \`cassandraorm generate model User\` - Generate model

## Documentation

- [CassandraORM Documentation](https://github.com/wemerson-silva-kz/cassandraorm-js)
- [Complete Features Guide](https://github.com/wemerson-silva-kz/cassandraorm-js/blob/main/docs/COMPLETE_DOCUMENTATION.md)

## License

MIT
`;
}
