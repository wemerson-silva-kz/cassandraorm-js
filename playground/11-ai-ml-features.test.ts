#!/usr/bin/env bun
import { 
  createClient, 
  AIMLManager,
  SemanticCache,
  type VectorSearchOptions 
} from '../src/index.js';

async function testAIMLFeatures() {
  console.log('🧠 Teste 11: Funcionalidades AI/ML\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_aiml'
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe'
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao Cassandra');

    // Test AIMLManager
    const aiml = new AIMLManager(client.driver, 'test_aiml');
    console.log('✅ AIMLManager criado');

    // Test vector table creation
    await aiml.createVectorTable('documents', {
      vectorDimension: 384,
      additionalFields: {
        title: 'text',
        content: 'text',
        category: 'text'
      }
    });
    console.log('✅ Tabela de vetores criada');

    // Test embedding generation
    const embedding = await aiml.generateEmbedding('test document content');
    console.log('✅ Embedding gerado:', embedding.length, 'dimensões');

    // Test vector insertion
    await aiml.insertVector('documents', {
      id: client.uuid(),
      title: 'Test Document',
      content: 'This is a test document for vector search',
      category: 'test',
      vector: embedding
    });
    console.log('✅ Vetor inserido');

    // Test similarity search
    const searchEmbedding = await aiml.generateEmbedding('test document');
    const searchOptions: VectorSearchOptions = {
      limit: 5,
      threshold: 0.7
    };
    
    const results = await aiml.similaritySearch('documents', searchEmbedding, searchOptions);
    console.log('✅ Busca por similaridade:', results.length, 'resultados');

    // Test semantic cache
    const cache = new SemanticCache({
      similarityThreshold: 0.85,
      maxSize: 1000,
      ttl: 3600
    });
    console.log('✅ SemanticCache criado');

    // Test cache operations
    const query = 'SELECT * FROM users WHERE active = true';
    const params = { active: true };
    const result = [{ id: '123', name: 'Test User' }];

    await cache.set(query, params, result);
    console.log('✅ Cache definido');

    const cached = await cache.get(query, params);
    console.log('✅ Cache recuperado:', cached ? 'encontrado' : 'não encontrado');

    // Test query optimization
    const optimizer = aiml.getQueryOptimizer();
    const optimizedQuery = await optimizer.optimizeQuery(query, {
      tableName: 'users',
      expectedRows: 1000,
      indexHints: ['active_idx']
    });
    console.log('✅ Query otimizada:', optimizedQuery.suggestions.length, 'sugestões');

    // Test anomaly detection
    const detector = aiml.getAnomalyDetector();
    const metrics = [
      { timestamp: new Date(), value: 100, metric: 'cpu_usage' },
      { timestamp: new Date(), value: 95, metric: 'cpu_usage' },
      { timestamp: new Date(), value: 200, metric: 'cpu_usage' } // anomaly
    ];

    const anomalies = await detector.detectAnomalies(metrics);
    console.log('✅ Detecção de anomalias:', anomalies.length, 'anomalias encontradas');

    console.log('\n📊 FUNCIONALIDADES AI/ML TESTADAS:');
    console.log('   • AIMLManager - Gerenciamento de AI/ML');
    console.log('   • Vector Search - Busca por similaridade');
    console.log('   • Embedding Generation - Geração de embeddings');
    console.log('   • Semantic Cache - Cache semântico inteligente');
    console.log('   • Query Optimization - Otimização de queries');
    console.log('   • Anomaly Detection - Detecção de anomalias');

    console.log('\n🎉 Teste AI/ML Features: PASSOU');

  } catch (error) {
    console.error('❌ Erro no teste AI/ML:', error.message);
  } finally {
    await client.close();
  }
}

testAIMLFeatures();
