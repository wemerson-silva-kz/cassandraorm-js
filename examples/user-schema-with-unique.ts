import { createClient } from '../src/index.js';

// Exemplo de schema com campos unique
const userSchema = {
  fields: {
    id: 'uuid',
    email: { 
      type: 'text', 
      unique: true,
      validate: { 
        required: true, 
        isEmail: true 
      }
    },
    username: {
      type: 'text',
      unique: true,
      validate: { 
        required: true, 
        minLength: 3,
        maxLength: 20 
      }
    },
    name: {
      type: 'text',
      validate: { 
        required: true, 
        minLength: 2 
      }
    },
    age: {
      type: 'int',
      validate: {
        min: 0,
        max: 150
      }
    },
    created_at: 'timestamp',
    updated_at: 'timestamp'
  },
  key: ['id'],
  options: {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  }
};

async function example() {
  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_unique'
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe'
    }
  });

  await client.connect();

  // Carregar o schema com validação de campos únicos
  const User = await client.loadSchema('users', userSchema);

  try {
    // Criar primeiro usuário
    const user1 = await User.create({
      email: 'john@example.com',
      username: 'john_doe',
      name: 'John Doe',
      age: 30
    });
    console.log('Usuário 1 criado:', user1.toJSON());

    // Tentar criar usuário com email duplicado (deve falhar)
    try {
      await User.create({
        email: 'john@example.com', // Email duplicado
        username: 'jane_doe',
        name: 'Jane Doe',
        age: 25
      });
    } catch (error) {
      console.log('Erro esperado - email duplicado:', error.message);
    }

    // Tentar criar usuário com username duplicado (deve falhar)
    try {
      await User.create({
        email: 'jane@example.com',
        username: 'john_doe', // Username duplicado
        name: 'Jane Doe',
        age: 25
      });
    } catch (error) {
      console.log('Erro esperado - username duplicado:', error.message);
    }

    // Criar usuário com dados únicos (deve funcionar)
    const user2 = await User.create({
      email: 'jane@example.com',
      username: 'jane_doe',
      name: 'Jane Doe',
      age: 25
    });
    console.log('Usuário 2 criado:', user2.toJSON());

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await client.disconnect();
  }
}

// Executar exemplo se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  example().catch(console.error);
}

export { userSchema, example };
