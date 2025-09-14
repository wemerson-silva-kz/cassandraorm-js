#!/usr/bin/env bun
import { createClient, CassandraTypes } from '../src/index.js';

async function testRelationships() {
  console.log('🔗 Teste 7: Relacionamentos\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: `test_relations_${Date.now()}`
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe'
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado');

    const User = await client.loadSchema('users', {
      fields: {
        id: CassandraTypes.UUID,
        name: CassandraTypes.TEXT,
        email: CassandraTypes.TEXT
      },
      key: ['id'],
      relations: {
        posts: { model: 'posts', foreignKey: 'user_id', type: 'hasMany' }
      }
    });

    const Post = await client.loadSchema('posts', {
      fields: {
        id: CassandraTypes.UUID,
        user_id: CassandraTypes.UUID,
        title: CassandraTypes.TEXT,
        content: CassandraTypes.TEXT,
        published: { type: CassandraTypes.BOOLEAN, default: false }
      },
      key: ['id'],
      relations: {
        user: { model: 'users', foreignKey: 'user_id', type: 'belongsTo' }
      }
    });

    console.log('✅ Schemas com relacionamentos carregados');

    // Criar usuário
    const user = await User.create({
      id: client.uuid(),
      name: 'John Doe',
      email: 'john@example.com'
    });
    console.log('✅ Usuário criado');

    // Criar posts
    const post1 = await Post.create({
      id: client.uuid(),
      user_id: user.id,
      title: 'Primeiro Post',
      content: 'Conteúdo do primeiro post',
      published: true
    });

    const post2 = await Post.create({
      id: client.uuid(),
      user_id: user.id,
      title: 'Segundo Post',
      content: 'Conteúdo do segundo post',
      published: false
    });

    console.log('✅ Posts criados com relacionamento');

    // Buscar posts do usuário
    const userPosts = await Post.find({ user_id: user.id }, { allow_filtering: true });
    console.log('✅ Posts do usuário encontrados:', userPosts.length);

    // Buscar posts publicados
    const publishedPosts = await Post.find({ published: true }, { allow_filtering: true });
    console.log('✅ Posts publicados:', publishedPosts.length);

    await client.disconnect();
    console.log('\n🎉 Teste relacionamentos: PASSOU');
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

testRelationships();
