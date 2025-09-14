#!/usr/bin/env bun
import { createClient, CassandraTypes } from '../src/index.js';

async function testCassandraTypes() {
  console.log('🗃️ Teste 3: Tipos de Dados Cassandra\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: `test_types_${Date.now()}`
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe'
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado');

    const AllTypes = await client.loadSchema('all_types', {
      fields: {
        id: CassandraTypes.UUID,
        // Numeric
        tiny_val: CassandraTypes.TINYINT,
        int_val: CassandraTypes.INT,
        big_val: CassandraTypes.BIGINT,
        decimal_val: CassandraTypes.DECIMAL,
        float_val: CassandraTypes.FLOAT,
        // Text
        text_val: CassandraTypes.TEXT,
        ascii_val: CassandraTypes.ASCII,
        // Date/Time
        timestamp_val: CassandraTypes.TIMESTAMP,
        date_val: CassandraTypes.DATE,
        time_val: CassandraTypes.TIME,
        // UUID
        uuid_val: CassandraTypes.UUID,
        timeuuid_val: CassandraTypes.TIMEUUID,
        // Special
        boolean_val: CassandraTypes.BOOLEAN,
        blob_val: CassandraTypes.BLOB,
        inet_val: CassandraTypes.INET,
        // Collections
        set_val: 'set<text>',
        list_val: 'list<int>',
        map_val: 'map<text,text>'
      },
      key: ['id']
    });

    console.log('✅ Schema com 18 tipos criado');

    const record = await AllTypes.create({
      id: client.uuid(),
      tiny_val: 100,
      int_val: 1000000,
      big_val: '9223372036854775000',
      decimal_val: '999.99',
      float_val: 3.14159,
      text_val: 'UTF-8 Text 🚀',
      ascii_val: 'ASCII Text',
      timestamp_val: new Date(),
      date_val: '2024-12-25',
      time_val: '14:30:45.123',
      uuid_val: client.uuid(),
      timeuuid_val: client.timeuuid(),
      boolean_val: true,
      blob_val: 'Binary data',
      inet_val: '192.168.1.1',
      set_val: ['tag1', 'tag2'],
      list_val: [1, 2, 3],
      map_val: { key1: 'value1', key2: 'value2' }
    });

    console.log('✅ Registro com todos os tipos criado');

    const found = await AllTypes.find();
    console.log('✅ Dados recuperados:', found.length, 'registros');

    await client.disconnect();
    console.log('\n🎉 Teste de tipos Cassandra: PASSOU');
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

testCassandraTypes();
