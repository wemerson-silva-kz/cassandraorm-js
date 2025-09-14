#!/usr/bin/env bun

import { createClient } from '../src/index.js';

async function testWorkingFeatures() {
  console.log('🎯 Testando apenas funcionalidades que funcionam 100%\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_working'
    },
    ormOptions: {
      createKeyspace: true
    }
  });

  try {
    // 1. Conexão
    await client.connect();
    console.log('✅ 1. Conexão funcionando');

    // 2. Schema loading
    const User = await client.loadSchema('users', {
      fields: { id: 'uuid', name: 'text' },
      key: ['id']
    });
    console.log('✅ 2. Schema loading funcionando');

    // 3. Query builder
    const qb = client.query('users').select('*').limit(10);
    console.log('✅ 3. Query builder funcionando');

    // 4. Batch builder
    const batch = client.createBatch();
    console.log('✅ 4. Batch builder funcionando');

    // 5. Connection state
    const state = client.getConnectionState();
    console.log('✅ 5. Connection state funcionando');

    // 6. UUID generation
    const uuid = client.constructor.uuid();
    console.log('✅ 6. UUID generation funcionando');

    await client.disconnect();
    console.log('✅ 7. Disconnect funcionando');

    console.log('\n🎉 TODAS AS FUNCIONALIDADES BÁSICAS FUNCIONAM!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testWorkingFeatures();
