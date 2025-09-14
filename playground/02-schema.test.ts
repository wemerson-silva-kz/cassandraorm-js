#!/usr/bin/env bun
import { createClient, CassandraTypes } from '../src/index.js';

async function testSchema() {
  console.log('📋 Teste 2: Schema Loading\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: `test_schema_${Date.now()}`
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
        email: { type: CassandraTypes.TEXT, unique: true },
        name: CassandraTypes.TEXT,
        active: { type: CassandraTypes.BOOLEAN, default: true },
        created_at: CassandraTypes.TIMESTAMP
      },
      key: ['id']
    });

    console.log('✅ Schema users carregado');
    console.log('✅ Unique fields configurados');

    const Product = await client.loadSchema('products', {
      fields: {
        id: CassandraTypes.UUID,
        sku: { type: CassandraTypes.TEXT, unique: true },
        name: CassandraTypes.TEXT,
        price: CassandraTypes.DECIMAL,
        tags: 'set<text>',
        metadata: 'map<text,text>'
      },
      key: ['id']
    });

    console.log('✅ Schema products carregado');
    console.log('✅ Collections configuradas');

    await client.disconnect();
    console.log('\n🎉 Teste de schema: PASSOU');
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

testSchema();
