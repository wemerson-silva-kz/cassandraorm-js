#!/usr/bin/env bun
import { createClient } from '../src/index.js';

async function testConnection() {
  console.log('🔌 Teste 1: Conexão e Desconexão\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: `test_conn_${Date.now()}`
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe'
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao Cassandra');

    const stats = client.getConnectionStats();
    console.log('✅ Stats obtidas:', typeof stats);

    await client.disconnect();
    console.log('✅ Desconectado com sucesso');

    console.log('\n🎉 Teste de conexão: PASSOU');
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

testConnection();
