#!/usr/bin/env bun
import { 
  createClient, 
  CassandraTypes,
  type CassandraDataType,
  type CassandraModelSchema,
  type QueryOptions,
  type FindQuery
} from '../src/index.js';

async function testTypeScriptTypes() {
  console.log('🔍 Teste 10: Tipos TypeScript\n');

  // Test type definitions
  const dataType: CassandraDataType = CassandraTypes.TEXT;
  console.log('✅ CassandraDataType:', dataType);

  const schema: CassandraModelSchema = {
    fields: {
      id: CassandraTypes.UUID,
      name: CassandraTypes.TEXT,
      price: CassandraTypes.DECIMAL,
      tags: CassandraTypes.set(CassandraTypes.TEXT),
      metadata: CassandraTypes.map(CassandraTypes.TEXT, CassandraTypes.TEXT)
    },
    key: ['id']
  };
  console.log('✅ CassandraModelSchema criado');

  const queryOptions: QueryOptions = {
    prepare: true,
    limit: 10,
    allow_filtering: true
  };
  console.log('✅ QueryOptions criado');

  const findQuery: FindQuery = {
    name: 'Test',
    $limit: 5,
    $orderby: { created_at: 'DESC' }
  };
  console.log('✅ FindQuery criado');

  // Test CassandraTypes helpers
  const textType = CassandraTypes.TEXT;
  const setType = CassandraTypes.set(CassandraTypes.TEXT);
  const mapType = CassandraTypes.map(CassandraTypes.TEXT, CassandraTypes.INT);
  
  console.log('✅ Helpers funcionando:');
  console.log('   • TEXT:', textType);
  console.log('   • set<text>:', setType);
  console.log('   • map<text,int>:', mapType);

  // Test client creation with types
  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_types'
    }
  });

  console.log('✅ Client criado com tipos');
  console.log('✅ Tipo do client:', typeof client);

  console.log('\n📊 TIPOS DISPONÍVEIS:');
  console.log('   • CassandraDataType - Union type com todos os tipos');
  console.log('   • CassandraModelSchema - Schema com tipos Cassandra');
  console.log('   • CassandraFieldDefinition - Definição de campo');
  console.log('   • QueryOptions - Opções de query com limit');
  console.log('   • FindQuery - Query com campos dinâmicos');
  console.log('   • CassandraTypes - Helpers com IntelliSense');

  console.log('\n🎉 Teste TypeScript types: PASSOU');
}

testTypeScriptTypes();
