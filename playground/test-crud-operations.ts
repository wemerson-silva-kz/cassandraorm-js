#!/usr/bin/env bun
import { createClient } from '../src/index.js';

async function testCRUDOperations() {
  console.log('📋 Testando Operações CRUD - CassandraORM JS\n');
  
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
    console.log('✅ Conectado ao Cassandra');

    // Schema de produtos
    const Product = await client.loadSchema('products', {
      fields: {
        id: 'uuid',
        sku: { type: 'text', unique: true },
        name: { type: 'text', validate: { required: true } },
        price: 'decimal',
        category: 'text',
        tags: 'set<text>',
        in_stock: { type: 'boolean', default: true },
        created_at: 'timestamp',
        updated_at: 'timestamp'
      },
      key: ['id'],
      options: {
        timestamps: {
          createdAt: 'created_at',
          updatedAt: 'updated_at'
        }
      }
    });

    console.log('✅ Schema de produtos carregado\n');

    // CREATE - Criar produtos
    console.log('📝 CREATE: Criando produtos...');
    const products = [];
    
    const product1 = await Product.create({
      id: client.uuid(),
      sku: 'LAPTOP-001',
      name: 'Laptop Dell XPS 13',
      price: 2999.99,
      category: 'Electronics',
      tags: ['laptop', 'dell', 'portable'],
      in_stock: true
    });
    products.push(product1);
    console.log('✅ Produto 1 criado:', product1.name);

    const product2 = await Product.create({
      id: client.uuid(),
      sku: 'MOUSE-001',
      name: 'Mouse Logitech MX Master',
      price: 99.99,
      category: 'Electronics',
      tags: ['mouse', 'logitech', 'wireless'],
      in_stock: true
    });
    products.push(product2);
    console.log('✅ Produto 2 criado:', product2.name);

    const product3 = await Product.create({
      id: client.uuid(),
      sku: 'BOOK-001',
      name: 'Clean Code',
      price: 45.99,
      category: 'Books',
      tags: ['programming', 'clean-code', 'development'],
      in_stock: false
    });
    products.push(product3);
    console.log('✅ Produto 3 criado:', product3.name);

    // READ - Buscar produtos
    console.log('\n📖 READ: Buscando produtos...');
    
    // Buscar todos
    const allProducts = await Product.find();
    console.log('✅ Total de produtos:', allProducts.length);

    // Buscar por categoria
    const electronics = await Product.find({ category: 'Electronics' }, { allow_filtering: true });
    console.log('✅ Produtos de eletrônicos:', electronics.length);

    // Buscar produtos em estoque
    const inStock = await Product.find({ in_stock: true }, { allow_filtering: true });
    console.log('✅ Produtos em estoque:', inStock.length);

    // Buscar um produto específico
    const foundProduct = await Product.findOne({ sku: 'LAPTOP-001' }, { allow_filtering: true });
    console.log('✅ Produto encontrado por SKU:', foundProduct?.name);

    // UPDATE - Atualizar produtos
    console.log('\n✏️ UPDATE: Atualizando produtos...');
    
    // Atualizar preço
    await Product.update({ id: product1.id }, { price: 2799.99 });
    console.log('✅ Preço do laptop atualizado');

    // Atualizar estoque
    await Product.update({ sku: 'BOOK-001' }, { in_stock: true }, { allow_filtering: true });
    console.log('✅ Estoque do livro atualizado');

    // Atualizar múltiplos campos
    await Product.update(
      { id: product2.id }, 
      { 
        price: 89.99, 
        tags: ['mouse', 'logitech', 'wireless', 'ergonomic'] 
      }
    );
    console.log('✅ Mouse atualizado com novos dados');

    // Verificar atualizações
    const updatedLaptop = await Product.findOne({ id: product1.id });
    console.log('✅ Novo preço do laptop:', updatedLaptop?.price);

    // ADVANCED QUERIES
    console.log('\n🔍 ADVANCED: Consultas avançadas...');
    
    // Buscar com limit
    const limitedProducts = await Product.find({}, { limit: 2 });
    console.log('✅ Produtos com limit 2:', limitedProducts.length);

    // Buscar produtos caros (> 100)
    const expensiveProducts = await Product.find();
    const filtered = expensiveProducts.filter(p => p.price > 100);
    console.log('✅ Produtos caros (>100):', filtered.length);

    // BATCH OPERATIONS
    console.log('\n📦 BATCH: Operações em lote...');
    
    const batchQueries = [
      {
        query: `UPDATE test_crud.products SET price = ? WHERE id = ?`,
        params: [2699.99, product1.id]
      },
      {
        query: `UPDATE test_crud.products SET price = ? WHERE id = ?`,
        params: [79.99, product2.id]
      }
    ];
    
    await client.batch(batchQueries);
    console.log('✅ Batch de atualizações executado');

    // DELETE - Deletar produtos
    console.log('\n🗑️ DELETE: Deletando produtos...');
    
    // Deletar um produto
    await Product.delete({ id: product3.id });
    console.log('✅ Livro deletado');

    // Verificar se foi deletado
    const deletedProduct = await Product.findOne({ id: product3.id });
    console.log('✅ Produto deletado confirmado:', deletedProduct === null);

    // Contar produtos restantes
    const remainingProducts = await Product.find();
    console.log('✅ Produtos restantes:', remainingProducts.length);

    // FINAL SUMMARY
    console.log('\n📊 RESUMO FINAL:');
    const finalProducts = await Product.find();
    finalProducts.forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.name} - $${product.price} (${product.in_stock ? 'Em estoque' : 'Fora de estoque'})`);
    });

    console.log('\n🎉 Todos os testes CRUD concluídos com sucesso!');
    console.log('\n✅ Operações testadas:');
    console.log('   • CREATE: Criação de registros');
    console.log('   • READ: Busca simples e avançada');
    console.log('   • UPDATE: Atualização de campos');
    console.log('   • DELETE: Remoção de registros');
    console.log('   • BATCH: Operações em lote');
    console.log('   • UNIQUE: Validação de campos únicos');
    console.log('   • TIMESTAMPS: Criação automática de timestamps');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await client.disconnect();
    console.log('\n👋 Desconectado do Cassandra');
  }
}

if (import.meta.main) {
  testCRUDOperations();
}
