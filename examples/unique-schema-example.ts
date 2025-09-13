import { createClient } from '../src/index.js';

// Schema com campos únicos
const userSchema = {
  fields: {
    id: 'uuid',
    email: {
      type: 'text',
      unique: true  // Campo único
    },
    username: {
      type: 'text', 
      unique: true  // Campo único
    },
    name: 'text',
    age: 'int',
    created_at: 'timestamp'
  },
  key: ['id']
};

async function uniqueSchemaExample() {
  console.log('🚀 Unique Schema Fields Example\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'unique_demo'
    }
  });

  await client.connect();
  console.log('✅ Connected to Cassandra');

  // Criar keyspace
  await client.execute(`
    CREATE KEYSPACE IF NOT EXISTS unique_demo
    WITH REPLICATION = {
      'class': 'SimpleStrategy',
      'replication_factor': 1
    }
  `);

  await client.execute('USE unique_demo');

  // Criar tabela
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY,
      email text,
      username text,
      name text,
      age int,
      created_at timestamp
    )
  `);

  // Carregar schema (automaticamente cria constraints únicos)
  const User = client.loadSchema('users', userSchema);
  console.log('✅ Schema loaded with unique constraints');

  // Teste 1: Inserir usuário válido
  try {
    const user1 = await User.create({
      id: client.uuid(),
      email: 'john@example.com',
      username: 'john_doe',
      name: 'John Doe',
      age: 30,
      created_at: new Date()
    });
    console.log('✅ User 1 created successfully');
  } catch (error) {
    console.log('❌ Error creating user 1:', error.message);
  }

  // Teste 2: Tentar inserir email duplicado
  try {
    const user2 = await User.create({
      id: client.uuid(),
      email: 'john@example.com', // Email duplicado
      username: 'john_smith',
      name: 'John Smith',
      age: 25,
      created_at: new Date()
    });
    console.log('❌ Should not reach here - duplicate email');
  } catch (error) {
    console.log('✅ Correctly prevented duplicate email:', error.message);
  }

  // Teste 3: Tentar inserir username duplicado
  try {
    const user3 = await User.create({
      id: client.uuid(),
      email: 'jane@example.com',
      username: 'john_doe', // Username duplicado
      name: 'Jane Doe',
      age: 28,
      created_at: new Date()
    });
    console.log('❌ Should not reach here - duplicate username');
  } catch (error) {
    console.log('✅ Correctly prevented duplicate username:', error.message);
  }

  // Teste 4: Inserir usuário com dados únicos
  try {
    const user4 = await User.create({
      id: client.uuid(),
      email: 'jane@example.com',
      username: 'jane_doe',
      name: 'Jane Doe',
      age: 28,
      created_at: new Date()
    });
    console.log('✅ User 4 created successfully');
  } catch (error) {
    console.log('❌ Error creating user 4:', error.message);
  }

  // Verificar dados
  const users = await client.execute('SELECT * FROM users');
  console.log(`\n👥 Total users: ${users.rows.length}`);
  users.rows.forEach(user => {
    console.log(`  - ${user.name} (${user.email}, @${user.username})`);
  });

  await client.disconnect();
  console.log('\n✅ Example completed!');
}

if (import.meta.main) {
  uniqueSchemaExample().catch(console.error);
}

export { uniqueSchemaExample };
