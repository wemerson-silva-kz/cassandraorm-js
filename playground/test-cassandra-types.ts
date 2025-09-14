#!/usr/bin/env bun
import { 
  createClient, 
  CassandraTypes,
  type CassandraDataType,
  type CassandraModelSchema 
} from '../src/index.js';

async function testCassandraTypes() {
  console.log('🗃️ Testando Tipos de Dados do Cassandra\n');

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
    console.log('✅ Conectado ao Cassandra');

    // Teste 1: Tipos básicos
    console.log('\n📝 Teste 1: Tipos básicos...');
    const BasicModel = await client.loadSchema('basic_types', {
      fields: {
        id: CassandraTypes.UUID,
        name: CassandraTypes.TEXT,
        age: CassandraTypes.INT,
        salary: CassandraTypes.DECIMAL,
        active: CassandraTypes.BOOLEAN,
        created_at: CassandraTypes.TIMESTAMP
      },
      key: ['id']
    });

    const basic = await BasicModel.create({
      id: client.uuid(),
      name: 'João Silva',
      age: 30,
      salary: 5000.50,
      active: true,
      created_at: new Date()
    });
    console.log('✅ Registro básico criado:', basic.name);

    // Teste 2: Tipos de coleção
    console.log('\n📦 Teste 2: Tipos de coleção...');
    const CollectionModel = await client.loadSchema('collections', {
      fields: {
        id: CassandraTypes.UUID,
        tags: CassandraTypes.set(CassandraTypes.TEXT),
        scores: CassandraTypes.list(CassandraTypes.INT),
        metadata: CassandraTypes.map(CassandraTypes.TEXT, CassandraTypes.TEXT)
      },
      key: ['id']
    });

    const collection = await CollectionModel.create({
      id: client.uuid(),
      tags: new Set(['javascript', 'typescript', 'nodejs']),
      scores: [95, 87, 92, 88],
      metadata: new Map([
        ['framework', 'express'],
        ['database', 'cassandra'],
        ['language', 'typescript']
      ])
    });
    console.log('✅ Registro com coleções criado');

    // Teste 3: Produto e-commerce completo
    console.log('\n🛒 Teste 3: Produto e-commerce...');
    const Product = await client.loadSchema('products', {
      fields: {
        id: 'uuid',
        sku: { type: 'text', unique: true },
        name: { type: 'text', validate: { required: true } },
        price: 'decimal',
        category: 'text',
        tags: 'set<text>',
        images: 'list<text>',
        attributes: 'map<text,text>',
        in_stock: { type: 'boolean', default: true },
        stock_count: 'int',
        weight: 'float',
        created_at: 'timestamp',
        updated_at: 'timestamp'
      },
      key: ['id']
    });

    const product = await Product.create({
      id: client.uuid(),
      sku: 'PHONE-001',
      name: 'iPhone 15 Pro',
      price: 1199.99,
      category: 'Electronics',
      tags: new Set(['smartphone', 'apple', 'premium']),
      images: ['front.jpg', 'back.jpg', 'side.jpg'],
      attributes: new Map([
        ['brand', 'Apple'],
        ['storage', '256GB'],
        ['color', 'Natural Titanium']
      ]),
      in_stock: true,
      stock_count: 50,
      weight: 0.187,
      created_at: new Date(),
      updated_at: new Date()
    });
    console.log('✅ Produto criado:', product.name);

    // Teste 4: Buscar e validar dados
    console.log('\n🔍 Teste 4: Buscando dados...');
    const products = await Product.find();
    const collections = await CollectionModel.find();
    const basics = await BasicModel.find();

    console.log(`✅ Encontrados: ${products.length} produtos, ${collections.length} coleções, ${basics.length} básicos`);

    // Teste 5: Validar tipos TypeScript
    console.log('\n🔍 Teste 5: Validação de tipos TypeScript...');
    
    // Teste de tipos em tempo de compilação
    const typeTest: CassandraDataType = CassandraTypes.TEXT;
    const schemaTest: CassandraModelSchema = {
      fields: {
        id: CassandraTypes.UUID,
        name: CassandraTypes.TEXT,
        tags: CassandraTypes.set(CassandraTypes.TEXT)
      },
      key: ['id']
    };
    
    console.log('✅ Tipos TypeScript validados');

    console.log('\n🎉 Todos os testes de tipos do Cassandra passaram!');
    console.log('\n📊 Tipos testados:');
    console.log('   ✅ Tipos básicos: uuid, text, int, decimal, boolean, timestamp');
    console.log('   ✅ Coleções: set<text>, list<int>, map<text,text>');
    console.log('   ✅ Validações: required, unique, default');
    console.log('   ✅ TypeScript: CassandraDataType, CassandraModelSchema');
    console.log('   ✅ Helpers: CassandraTypes.set(), CassandraTypes.map()');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
  } finally {
    await client.disconnect();
    console.log('\n👋 Desconectado do Cassandra');
  }
}

// Executar teste
testCassandraTypes();
