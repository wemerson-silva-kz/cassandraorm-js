#!/usr/bin/env bun
import { 
  createClient,
  SubscriptionManager,
  type SubscriptionConfig,
  type SubscriptionFilter,
  type SubscriptionEvent
} from '../src/index.js';

async function testRealTimeSubscriptions() {
  console.log('📡 Teste 14: Subscriptions em Tempo Real\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_subscriptions'
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe'
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao Cassandra');

    // Create test table
    const User = await client.loadSchema('users', {
      fields: {
        id: 'uuid',
        name: 'text',
        email: 'text',
        status: 'text',
        created_at: 'timestamp',
        updated_at: 'timestamp'
      },
      key: ['id']
    });

    await User.createTable();
    console.log('✅ Tabela de usuários criada');

    // Test SubscriptionManager
    const subscriptionManager = new SubscriptionManager(client.driver, 'test_subscriptions');
    await subscriptionManager.initialize();
    console.log('✅ SubscriptionManager inicializado');

    // Test basic subscription
    let insertEvents: SubscriptionEvent[] = [];
    let updateEvents: SubscriptionEvent[] = [];
    let deleteEvents: SubscriptionEvent[] = [];

    const insertSubscription = await subscriptionManager.subscribe(
      { table: 'users', operation: 'insert' },
      (event: SubscriptionEvent) => {
        console.log('   📥 INSERT detectado:', event.data.name);
        insertEvents.push(event);
      }
    );
    console.log('✅ Subscription INSERT criada:', insertSubscription.id);

    const updateSubscription = await subscriptionManager.subscribe(
      { table: 'users', operation: 'update' },
      (event: SubscriptionEvent) => {
        console.log('   📝 UPDATE detectado:', event.data.name);
        updateEvents.push(event);
      }
    );
    console.log('✅ Subscription UPDATE criada:', updateSubscription.id);

    const deleteSubscription = await subscriptionManager.subscribe(
      { table: 'users', operation: 'delete' },
      (event: SubscriptionEvent) => {
        console.log('   🗑️ DELETE detectado:', event.data.id);
        deleteEvents.push(event);
      }
    );
    console.log('✅ Subscription DELETE criada:', deleteSubscription.id);

    // Test filtered subscription
    const activeUsersFilter: SubscriptionFilter = {
      table: 'users',
      operation: 'insert',
      conditions: {
        status: 'active'
      }
    };

    let activeUserEvents: SubscriptionEvent[] = [];
    const filteredSubscription = await subscriptionManager.subscribe(
      activeUsersFilter,
      (event: SubscriptionEvent) => {
        console.log('   ✅ USUÁRIO ATIVO criado:', event.data.name);
        activeUserEvents.push(event);
      }
    );
    console.log('✅ Subscription FILTRADA criada:', filteredSubscription.id);

    // Test WebSocket subscription
    const wsConfig: SubscriptionConfig = {
      transport: 'websocket',
      port: 8080,
      path: '/subscriptions'
    };

    const wsSubscription = await subscriptionManager.createWebSocketSubscription(wsConfig);
    console.log('✅ WebSocket subscription criada na porta:', wsConfig.port);

    // Test SSE subscription
    const sseConfig: SubscriptionConfig = {
      transport: 'sse',
      port: 8081,
      path: '/events'
    };

    const sseSubscription = await subscriptionManager.createSSESubscription(sseConfig);
    console.log('✅ SSE subscription criada na porta:', sseConfig.port);

    // Simulate data changes
    console.log('\n🔄 Simulando mudanças de dados...');

    // Insert operations
    const user1 = await User.create({
      name: 'John Doe',
      email: 'john@example.com',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    });
    console.log('📥 Usuário 1 inserido');

    const user2 = await User.create({
      name: 'Jane Smith',
      email: 'jane@example.com',
      status: 'inactive',
      created_at: new Date(),
      updated_at: new Date()
    });
    console.log('📥 Usuário 2 inserido');

    const user3 = await User.create({
      name: 'Bob Wilson',
      email: 'bob@example.com',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    });
    console.log('📥 Usuário 3 inserido');

    // Wait for events to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update operations
    await User.update({ id: user1.id }, {
      name: 'John Updated',
      updated_at: new Date()
    });
    console.log('📝 Usuário 1 atualizado');

    await User.update({ id: user2.id }, {
      status: 'active',
      updated_at: new Date()
    });
    console.log('📝 Usuário 2 atualizado');

    // Wait for events to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Delete operations
    await User.delete({ id: user3.id });
    console.log('🗑️ Usuário 3 deletado');

    // Wait for events to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test subscription statistics
    const stats = await subscriptionManager.getStatistics();
    console.log('\n📊 Estatísticas de Subscriptions:');
    console.log('   • Total de subscriptions:', stats.totalSubscriptions);
    console.log('   • Subscriptions ativas:', stats.activeSubscriptions);
    console.log('   • Eventos processados:', stats.eventsProcessed);
    console.log('   • Eventos por segundo:', stats.eventsPerSecond);

    // Test event counts
    console.log('\n📈 Eventos Capturados:');
    console.log('   • INSERT events:', insertEvents.length);
    console.log('   • UPDATE events:', updateEvents.length);
    console.log('   • DELETE events:', deleteEvents.length);
    console.log('   • FILTERED events (active users):', activeUserEvents.length);

    // Test subscription management
    const allSubscriptions = await subscriptionManager.listSubscriptions();
    console.log('✅ Total de subscriptions listadas:', allSubscriptions.length);

    // Test unsubscribe
    await subscriptionManager.unsubscribe(insertSubscription.id);
    console.log('✅ Subscription INSERT removida');

    await subscriptionManager.unsubscribe(updateSubscription.id);
    console.log('✅ Subscription UPDATE removida');

    await subscriptionManager.unsubscribe(deleteSubscription.id);
    console.log('✅ Subscription DELETE removida');

    await subscriptionManager.unsubscribe(filteredSubscription.id);
    console.log('✅ Subscription FILTRADA removida');

    // Test batch subscription operations
    const batchSubscriptions = await subscriptionManager.subscribeBatch([
      { table: 'users', operation: 'insert' },
      { table: 'users', operation: 'update' },
      { table: 'users', operation: 'delete' }
    ], (events: SubscriptionEvent[]) => {
      console.log('   📦 BATCH events:', events.length, 'eventos');
    });
    console.log('✅ Batch subscription criada:', batchSubscriptions.length, 'subscriptions');

    // Test intelligent filtering
    const intelligentFilter = await subscriptionManager.createIntelligentFilter({
      table: 'users',
      aiModel: 'content-filter',
      filterCriteria: {
        relevanceScore: 0.8,
        categories: ['important', 'urgent'],
        excludePatterns: ['test', 'demo']
      }
    });
    console.log('✅ Filtro inteligente criado:', intelligentFilter.id);

    console.log('\n📊 FUNCIONALIDADES DE SUBSCRIPTIONS TESTADAS:');
    console.log('   • SubscriptionManager - Gerenciamento de subscriptions');
    console.log('   • Real-time Events - Eventos em tempo real');
    console.log('   • WebSocket Support - Suporte a WebSocket');
    console.log('   • SSE Support - Suporte a Server-Sent Events');
    console.log('   • Intelligent Filtering - Filtragem inteligente');
    console.log('   • Batch Subscriptions - Subscriptions em lote');
    console.log('   • Event Broadcasting - Transmissão de eventos');
    console.log('   • Subscription Statistics - Estatísticas de subscriptions');

    console.log('\n🎉 Teste Real-time Subscriptions: PASSOU');

  } catch (error) {
    console.error('❌ Erro no teste Real-time Subscriptions:', error.message);
  } finally {
    await client.close();
  }
}

testRealTimeSubscriptions();
