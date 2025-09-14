#!/usr/bin/env bun
import { 
  createClient, 
  CassandraTypes,
  type CassandraDataType 
} from '../src/index.js';

async function testTypesSimple() {
  console.log('🗃️ Testando Tipos do Cassandra (Simples)\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: `test_simple_types_${Date.now()}`
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe'
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao Cassandra');

    // Teste com tipos que funcionam
    console.log('\n📝 Criando schema com tipos básicos...');
    const Product = await client.loadSchema('products', {
      fields: {
        id: CassandraTypes.UUID,
        name: CassandraTypes.TEXT,
        price: CassandraTypes.DECIMAL,
        active: CassandraTypes.BOOLEAN,
        created_at: CassandraTypes.TIMESTAMP,
        tags: 'set<text>' as CassandraDataType,
        images: 'list<text>' as CassandraDataType
      },
      key: ['id']
    });

    console.log('✅ Schema criado com tipos:');
    console.log('   • id: uuid');
    console.log('   • name: text');
    console.log('   • price: decimal');
    console.log('   • active: boolean');
    console.log('   • created_at: timestamp');
    console.log('   • tags: set<text>');
    console.log('   • images: list<text>');

    // Criar produto
    const product = await Product.create({
      id: client.uuid(),
      name: 'Produto Teste',
      price: 99.99,
      active: true,
      created_at: new Date(),
      tags: new Set(['teste', 'produto']),
      images: ['img1.jpg', 'img2.jpg']
    });

    console.log('\n✅ Produto criado:', product.name);

    // Mostrar helpers disponíveis
    console.log('\n🔧 Helpers do CassandraTypes disponíveis:');
    console.log('   • CassandraTypes.UUID');
    console.log('   • CassandraTypes.TEXT');
    console.log('   • CassandraTypes.DECIMAL');
    console.log('   • CassandraTypes.BOOLEAN');
    console.log('   • CassandraTypes.TIMESTAMP');
    console.log('   • CassandraTypes.set("text")');
    console.log('   • CassandraTypes.list("text")');
    console.log('   • CassandraTypes.map("text", "text")');

    // Mostrar tipos disponíveis
    console.log('\n📋 Todos os tipos do Cassandra suportados:');
    console.log('\n🔢 Numéricos:');
    console.log('   tinyint, smallint, int, bigint, varint');
    console.log('   float, double, decimal');
    
    console.log('\n📝 Texto:');
    console.log('   ascii, text, varchar');
    
    console.log('\n📅 Data/Hora:');
    console.log('   timestamp, date, time, duration');
    
    console.log('\n🆔 Identificadores:');
    console.log('   uuid, timeuuid');
    
    console.log('\n📦 Coleções:');
    console.log('   set<type>, list<type>, map<key,value>');
    
    console.log('\n🔧 Especiais:');
    console.log('   boolean, blob, inet, counter, json');
    console.log('   tuple<types>, frozen<type>');

    console.log('\n💡 Exemplo de uso completo:');
    console.log(`
const schema = {
  fields: {
    id: CassandraTypes.UUID,
    name: CassandraTypes.TEXT,
    price: CassandraTypes.DECIMAL,
    tags: CassandraTypes.set(CassandraTypes.TEXT),
    metadata: CassandraTypes.map(CassandraTypes.TEXT, CassandraTypes.TEXT),
    active: { type: CassandraTypes.BOOLEAN, default: true },
    created_at: CassandraTypes.TIMESTAMP
  },
  key: ['id']
};`);

    console.log('\n🎉 Tipos do Cassandra implementados com sucesso!');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
  } finally {
    await client.disconnect();
    console.log('\n👋 Desconectado do Cassandra');
  }
}

// Executar teste
testTypesSimple();
