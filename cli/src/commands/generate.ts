import { promises as fs } from 'fs';
import path from 'path';

export async function generateModel(type: string, name: string, options: any) {
  console.log(`🔧 Generating ${type}: ${name}`);
  
  switch (type) {
    case 'model':
      await generateModelFile(name, options);
      break;
    case 'migration':
      await generateMigrationFile(name, options);
      break;
    case 'schema':
      await generateSchemaFile(name, options);
      break;
    default:
      console.error(`❌ Unknown type: ${type}`);
      process.exit(1);
  }
}

async function generateModelFile(name: string, options: any) {
  const modelName = name.charAt(0).toUpperCase() + name.slice(1);
  const tableName = name.toLowerCase() + 's';
  
  const fields = options.fields ? 
    options.fields.split(',').map((f: string) => {
      const [fieldName, fieldType = 'text'] = f.trim().split(':');
      return `    ${fieldName}: '${fieldType}'`;
    }).join(',\n') : 
    `    id: 'uuid',
    name: 'text',
    created_at: 'timestamp'`;

  const relations = options.relations ? `
  relations: {
    // Add your relations here
    // posts: { model: 'posts', foreignKey: 'user_id', type: 'hasMany' }
  },` : '';

  const aiFeatures = options.ai ? `
  // AI/ML Features
  vectorFields: ['description_embedding'],
  semanticSearch: true,` : '';

  const modelContent = `import { createClient } from 'cassandraorm-js';

export interface ${modelName} {
  ${options.fields ? options.fields.split(',').map((f: string) => {
    const [fieldName, fieldType = 'string'] = f.trim().split(':');
    const tsType = fieldType === 'uuid' ? 'string' : 
                   fieldType === 'int' ? 'number' : 
                   fieldType === 'timestamp' ? 'Date' : 'string';
    return `  ${fieldName}: ${tsType};`;
  }).join('\n  ') : `  id: string;
  name: string;
  created_at: Date;`}
}

export const ${name}Schema = {
  fields: {
${fields}
  },${relations}${aiFeatures}
  key: ['id']
};

// Usage example:
// const client = createClient(config);
// const ${modelName}Model = await client.loadSchema<${modelName}>('${tableName}', ${name}Schema);
`;

  const modelPath = path.join(process.cwd(), 'src/models', `${name}.ts`);
  await fs.mkdir(path.dirname(modelPath), { recursive: true });
  await fs.writeFile(modelPath, modelContent);
  
  console.log(`✅ Model created: ${modelPath}`);
}

async function generateMigrationFile(name: string, options: any) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
  const migrationName = `${timestamp}_${name}`;
  
  const migrationContent = `import { SchemaEvolution } from 'cassandraorm-js';

export async function up(evolution: SchemaEvolution) {
  // Add your migration logic here
  const migration = evolution
    .migration('${migrationName}', '${name}')
    .addTable('${name.toLowerCase()}', {
      id: 'uuid PRIMARY KEY',
      name: 'text',
      created_at: 'timestamp'
    })
    .build();
    
  return await evolution.migrate();
}

export async function down(evolution: SchemaEvolution) {
  // Add rollback logic here
  const migration = evolution
    .migration('${migrationName}_rollback', 'Rollback ${name}')
    .dropTable('${name.toLowerCase()}')
    .build();
    
  return await evolution.migrate();
}
`;

  const migrationPath = path.join(process.cwd(), 'src/migrations', `${migrationName}.ts`);
  await fs.mkdir(path.dirname(migrationPath), { recursive: true });
  await fs.writeFile(migrationPath, migrationContent);
  
  console.log(`✅ Migration created: ${migrationPath}`);
}

async function generateSchemaFile(name: string, options: any) {
  const schemaContent = `// CassandraORM Schema: ${name}
export const ${name}Schema = {
  fields: {
    id: 'uuid',
    name: {
      type: 'text',
      validate: {
        required: true,
        minLength: 2
      }
    },
    email: {
      type: 'text',
      validate: {
        required: true,
        isEmail: true
      }
    },
    created_at: {
      type: 'timestamp',
      default: () => new Date()
    }
  },
  key: ['id'],
  indexes: {
    email_idx: {
      on: 'email',
      using: 'org.apache.cassandra.index.sasi.SASIIndex'
    }
  }
};
`;

  const schemaPath = path.join(process.cwd(), 'src/schemas', `${name}.ts`);
  await fs.mkdir(path.dirname(schemaPath), { recursive: true });
  await fs.writeFile(schemaPath, schemaContent);
  
  console.log(`✅ Schema created: ${schemaPath}`);
}
