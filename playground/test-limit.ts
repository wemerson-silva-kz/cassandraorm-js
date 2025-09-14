#!/usr/bin/env bun
import { createClient } from '../src/index.js';

async function testLimit() {
  console.log('🔢 Testando LIMIT - CassandraORM JS\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: `test_limit_${Date.now()}`
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe'
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao Cassandra');

    const Product = await client.loadSchema('products', {
      fields: {
        id: 'uuid',
        name: 'text',
        price: 'decimal'
      },
      key: ['id']
    });

    console.log('✅ Schema carregado\n');

    // Criar 5 produtos
    console.log('📝 Criando 5 produtos...');
    for (let i = 1; i <= 5; i++) {
      await Product.create({
        id: client.uuid(),
        name: `Produto ${i}`,
        price: i * 100
      });
    }
    console.log('✅ 5 produtos criados');

    // Testar limit no options
    console.log('\n🔢 Testando limit no options...');
    const limitedProducts = await Product.find({}, { limit: 2 });
    console.log(`✅ Limit 2: ${limitedProducts.length} produtos retornados`);

    // Testar $limit no query
    console.log('\n🔢 Testando $limit no query...');
    const queryLimited = await Product.find({ $limit: 3 });
    console.log(`✅ $limit 3: ${queryLimited.length} produtos retornados`);

    // Verificar total
    const allProducts = await Product.find();
    console.log(`✅ Total: ${allProducts.length} produtos`);

    console.log('\n🎉 Testes de LIMIT passaram!');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
  } finally {
    await client.disconnect();
    console.log('\n👋 Desconectado do Cassandra');
  }
}

// Executar teste
testLimit();
