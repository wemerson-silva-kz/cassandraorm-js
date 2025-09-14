#!/usr/bin/env bun
import { createClient, CassandraTypes } from '../src/index.js';

async function testCRUD() {
  console.log('📝 Teste 4: Operações CRUD\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: `test_crud_${Date.now()}`
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
        sku: { type: CassandraTypes.TEXT, unique: true },
        name: CassandraTypes.TEXT,
        price: CassandraTypes.DECIMAL,
        active: { type: CassandraTypes.BOOLEAN, default: true }
      },
      key: ['id']
    });

    console.log('✅ Schema carregado');

    // CREATE
    const product1 = await Product.create({
      id: client.uuid(),
      sku: 'LAPTOP-001',
      name: 'Laptop Dell',
      price: '2499.99',
      active: true
    });
    console.log('✅ CREATE: Produto criado');

    const product2 = await Product.create({
      id: client.uuid(),
      sku: 'MOUSE-001',
      name: 'Mouse Logitech',
      price: '299.99',
      active: true
    });
    console.log('✅ CREATE: Segundo produto criado');

    // READ
    const allProducts = await Product.find();
    console.log('✅ READ: Total produtos:', allProducts.length);

    const foundBySku = await Product.findOne({ sku: 'LAPTOP-001' }, { allow_filtering: true });
    console.log('✅ READ: Encontrado por SKU:', foundBySku?.name);

    const limited = await Product.find({}, { limit: 1 });
    console.log('✅ READ: Com limit:', limited.length);

    // UPDATE
    await Product.update({ id: product1.id }, { price: '2799.99' });
    console.log('✅ UPDATE: Preço atualizado');

    // DELETE
    await Product.delete({ id: product2.id });
    console.log('✅ DELETE: Produto deletado');

    const remaining = await Product.find();
    console.log('✅ Produtos restantes:', remaining.length);

    await client.disconnect();
    console.log('\n🎉 Teste CRUD: PASSOU');
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

testCRUD();
