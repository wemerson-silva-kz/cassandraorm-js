#!/usr/bin/env bun
import { createClient, CassandraTypes } from '../src/index.js';

async function testAdvancedQueries() {
  console.log('🔍 Teste 8: Queries Avançadas\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: `test_queries_${Date.now()}`
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe'
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado');

    const Product = await client.loadSchema('products', {
      fields: {
        id: CassandraTypes.UUID,
        name: CassandraTypes.TEXT,
        price: CassandraTypes.DECIMAL,
        category: CassandraTypes.TEXT,
        active: { type: CassandraTypes.BOOLEAN, default: true },
        created_at: CassandraTypes.TIMESTAMP
      },
      key: ['id']
    });

    console.log('✅ Schema carregado');

    // Criar produtos de teste
    await Product.createMany([
      {
        id: client.uuid(),
        name: 'Laptop Premium',
        price: '2999.99',
        category: 'Electronics',
        active: true,
        created_at: new Date()
      },
      {
        id: client.uuid(),
        name: 'Mouse Gamer',
        price: '199.99',
        category: 'Electronics',
        active: true,
        created_at: new Date()
      },
      {
        id: client.uuid(),
        name: 'Cadeira Ergonômica',
        price: '899.99',
        category: 'Furniture',
        active: false,
        created_at: new Date()
      },
      {
        id: client.uuid(),
        name: 'Monitor 4K',
        price: '1499.99',
        category: 'Electronics',
        active: true,
        created_at: new Date()
      }
    ]);

    console.log('✅ Produtos de teste criados');

    // Query com limit
    const limited = await Product.find({}, { limit: 2 });
    console.log('✅ Query com limit:', limited.length, 'produtos');

    // Query com $limit
    const queryLimited = await Product.find({ $limit: 3 });
    console.log('✅ Query com $limit:', queryLimited.length, 'produtos');

    // Query com filtro e allow_filtering
    const electronics = await Product.find({ category: 'Electronics' }, { allow_filtering: true });
    console.log('✅ Produtos Electronics:', electronics.length);

    const activeProducts = await Product.find({ active: true }, { allow_filtering: true });
    console.log('✅ Produtos ativos:', activeProducts.length);

    // Query com findOne
    const firstProduct = await Product.findOne({});
    console.log('✅ Primeiro produto:', firstProduct?.name);

    // Query específica
    const laptop = await Product.findOne({ name: 'Laptop Premium' }, { allow_filtering: true });
    console.log('✅ Laptop encontrado:', laptop?.name);

    // Count total
    const totalProducts = await Product.find();
    console.log('✅ Total de produtos:', totalProducts.length);

    await client.disconnect();
    console.log('\n🎉 Teste queries avançadas: PASSOU');
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

testAdvancedQueries();
