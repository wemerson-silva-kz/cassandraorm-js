import { createClient } from '../src/index.js';

async function autoCreateExample() {
  console.log('🚀 Auto-Create Keyspace & Table Example\n');

  // Schema do usuário
  const userSchema = {
    fields: {
      id: 'uuid',
      email: {
        type: 'text',
        unique: true
      },
      name: 'text',
      age: 'int',
      created_at: 'timestamp'
    },
    key: ['id']
  };

  // Cliente com auto-criação habilitada
  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'auto_demo' // Keyspace será criado automaticamente
    },
    ormOptions: {
      createKeyspace: true, // Criar keyspace automaticamente
      migration: 'safe',    // Criar tabelas automaticamente
      defaultReplicationStrategy: {
        class: 'SimpleStrategy',
        replication_factor: 1
      }
    }
  });

  // Conectar (criará keyspace automaticamente se não existir)
  await client.connect();
  console.log('✅ Connected and keyspace created automatically');

  // Carregar schema (criará tabela automaticamente)
  const User = client.loadSchema('users', userSchema);
  console.log('✅ Schema loaded and table created automatically');

  // Testar inserção
  const user = {
    id: client.uuid(),
    email: 'auto@example.com',
    name: 'Auto User',
    age: 30,
    created_at: new Date()
  };

  // Inserir usando o modelo
  await client.execute(
    'INSERT INTO users (id, email, name, age, created_at) VALUES (?, ?, ?, ?, ?)',
    [user.id, user.email, user.name, user.age, user.created_at]
  );
  console.log('✅ User inserted successfully');

  // Verificar dados
  const users = await client.execute('SELECT * FROM users');
  console.log(`✅ Found ${users.rows.length} users in auto-created table`);
  
  users.rows.forEach((user: any) => {
    console.log(`  - ${user.name} (${user.email})`);
  });

  await client.disconnect();
  console.log('\n✅ Auto-create example completed!');
}

if (import.meta.main) {
  autoCreateExample().catch(console.error);
}

export { autoCreateExample };
