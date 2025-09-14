#!/usr/bin/env bun
import { createClient } from '../src/index.js';

async function testCRUDOperations() {
  console.log('📋 Testando Operações CRUD - CassandraORM JS\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: `test_crud_simple_${Date.now()}`
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
        sku: { type: 'text', unique: true },
        name: 'text',
        price: 'decimal',
        category: 'text',
        in_stock: 'boolean'
      },
      key: ['id']
    });

    console.log('✅ Schema de produtos carregado\n');

    // CREATE - Criar produtos
    console.log('📝 CREATE: Criando produtos...');
    
    const product1 = await Product.create({
      id: client.uuid(),
      sku: 'LAPTOP-001',
      name: 'Laptop Dell XPS 13',
      price: 2499.99,
      category: 'Electronics',
      in_stock: true
    });
    console.log('✅ Produto 1 criado:', product1.name);

    const product2 = await Product.create({
      id: client.uuid(),
      sku: 'MOUSE-001',
      name: 'Mouse Logitech MX Master',
      price: 299.99,
      category: 'Electronics',
      in_stock: true
    });
    console.log('✅ Produto 2 criado:', product2.name);

    // READ - Buscar produtos
    console.log('\n📖 READ: Buscando produtos...');
    
    const allProducts = await Product.find();
    console.log('✅ Total de produtos:', allProducts.length);

    const foundProduct = await Product.findOne({ sku: 'LAPTOP-001' }, { allow_filtering: true });
    console.log('✅ Produto encontrado por SKU:', foundProduct?.name);

    // UPDATE - Atualizar produtos
    console.log('\n✏️ UPDATE: Atualizando produtos...');
    
    await Product.update({ id: product1.id }, { price: 2799.99 });
    console.log('✅ Preço do laptop atualizado');

    // DELETE - Deletar produto
    console.log('\n🗑️ DELETE: Deletando produto...');
    
    await Product.delete({ id: product2.id });
    console.log('✅ Mouse deletado');

    // Verificar produtos restantes
    const remainingProducts = await Product.find();
    console.log('✅ Produtos restantes:', remainingProducts.length);

    console.log('\n🎉 Todos os testes CRUD passaram!');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
  } finally {
    await client.disconnect();
    console.log('\n👋 Desconectado do Cassandra');
  }
}

// Executar teste
testCRUDOperations();
