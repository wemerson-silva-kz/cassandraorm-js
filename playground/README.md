# 🎮 CassandraORM JS - Playground

Este diretório contém testes abrangentes para todas as funcionalidades do CassandraORM JS. Cada arquivo de teste demonstra uma funcionalidade específica do ORM.

## 📋 Testes Disponíveis

### 🔧 Funcionalidades Básicas (01-10)
- **01-connection.test.ts** - Conexão e desconexão básica
- **02-schema.test.ts** - Carregamento de schemas
- **03-cassandra-types.test.ts** - Tipos de dados Cassandra
- **04-crud.test.ts** - Operações CRUD básicas
- **05-unique-constraints.test.ts** - Restrições únicas
- **06-batch-operations.test.ts** - Operações em lote
- **07-relationships.test.ts** - Relacionamentos entre modelos
- **08-advanced-queries.test.ts** - Consultas avançadas
- **09-utilities.test.ts** - Utilitários diversos
- **10-typescript-types.test.ts** - Tipos TypeScript

### 🚀 Funcionalidades Avançadas (11-17)
- **11-ai-ml-features.test.ts** - IA/ML e busca vetorial
- **12-event-sourcing.test.ts** - Event Sourcing & CQRS
- **13-distributed-transactions.test.ts** - Transações distribuídas
- **14-real-time-subscriptions.test.ts** - Subscriptions em tempo real
- **15-graphql-integration.test.ts** - Integração GraphQL
- **16-performance-monitoring.test.ts** - Monitoramento de performance
- **17-complete-integration.test.ts** - Integração completa (E-commerce)

## 🚀 Como Executar

### Executar Todos os Testes
```bash
# Executar todos os testes do playground
npm run test:playground

# Ou usando bun diretamente
bun run playground/run-all-tests.ts
```

### Executar Testes Individuais
```bash
# Funcionalidades básicas
npm run test:quick          # Testes básicos
npm run test:crud           # CRUD operations
npm run test:unique         # Unique constraints
npm run test:types          # TypeScript types

# Funcionalidades avançadas
npm run test:ai             # AI/ML features
npm run test:events         # Event Sourcing
npm run test:transactions   # Distributed Transactions
npm run test:subscriptions  # Real-time Subscriptions
npm run test:graphql        # GraphQL Integration
npm run test:performance    # Performance Monitoring
npm run test:integration    # Complete Integration

# Ou executar diretamente
bun run playground/01-connection.test.ts
bun run playground/11-ai-ml-features.test.ts
```

## 📊 Funcionalidades Testadas

### 🔧 Core Features
- ✅ **BaseModel & CassandraClient** - Core ORM functionality
- ✅ **Model Schema Definition** - Fields, keys, relations, validation
- ✅ **CRUD Operations** - Create, Read, Update, Delete
- ✅ **Unique Constraints** - Field-level and schema-level validation
- ✅ **Batch Operations** - CreateMany with duplicate handling
- ✅ **TypeScript Support** - Full type definitions

### 🧠 AI/ML Integration
- ✅ **AIMLManager** - AI/ML operations management
- ✅ **Vector Search** - Similarity search with embeddings
- ✅ **Semantic Cache** - AI-powered intelligent caching
- ✅ **Query Optimization** - AI-powered query optimization
- ✅ **Anomaly Detection** - Performance anomaly detection

### 🔄 Event Sourcing & CQRS
- ✅ **EventStore** - Event storage and retrieval
- ✅ **BaseAggregateRoot** - Aggregate root pattern
- ✅ **AggregateRepository** - Repository pattern for aggregates
- ✅ **Domain Events** - Domain event handling
- ✅ **Saga Manager** - Saga pattern implementation

### 🔀 Distributed Transactions
- ✅ **DistributedTransactionManager** - 2PC transactions
- ✅ **TransactionCoordinator** - Transaction coordination
- ✅ **SagaOrchestrator** - Saga orchestration
- ✅ **Compensation Logic** - Failure recovery

### 📡 Real-time Subscriptions
- ✅ **SubscriptionManager** - Real-time data subscriptions
- ✅ **WebSocket Support** - Real-time communication
- ✅ **SSE Support** - Server-Sent Events
- ✅ **Intelligent Filtering** - Smart subscription filtering

### 🌐 GraphQL Integration
- ✅ **GraphQLSchemaGenerator** - Auto-generate GraphQL schemas
- ✅ **CassandraDataSource** - GraphQL data source
- ✅ **CRUD Resolvers** - Automatic CRUD resolvers
- ✅ **Custom Types** - Custom GraphQL types

### 📊 Performance & Monitoring
- ✅ **Monitor** - System monitoring
- ✅ **MetricsCollector** - Performance metrics collection
- ✅ **PerformanceProfiler** - Query performance profiling
- ✅ **PerformanceOptimizer** - Performance optimization
- ✅ **Health Monitoring** - System health checks

### 🎯 Complete Integration
- ✅ **E-commerce Platform** - Complete workflow integration
- ✅ **Multi-feature Integration** - All features working together
- ✅ **Real-world Scenarios** - Practical use cases

## 🔧 Pré-requisitos

### Cassandra/ScyllaDB
```bash
# Usando Docker
docker run --name cassandra -p 9042:9042 -d cassandra:latest

# Ou usando Docker Compose (recomendado)
docker-compose up -d
```

### Node.js/Bun
```bash
# Instalar dependências
npm install
# ou
bun install
```

## 📈 Relatório de Testes

Após executar `npm run test:playground`, você verá um relatório completo:

```
📊 RELATÓRIO FINAL DOS TESTES
================================================================================

📈 RESUMO GERAL:
   • Total de testes: 17
   • ✅ Passou: 17
   • ❌ Falhou: 0
   • ⏭️  Pulou: 0
   • 📊 Taxa de sucesso: 100.0%
   • ⏱️  Tempo total: 45000ms (45.00s)

🔍 FUNCIONALIDADES TESTADAS:
   01. ✅ Connection & Disconnection - Conexão básica
   02. ✅ Schema Loading - Carregamento de schemas
   03. ✅ Cassandra Types - Tipos de dados Cassandra
   04. ✅ CRUD Operations - Operações básicas
   05. ✅ Unique Constraints - Restrições únicas
   06. ✅ Batch Operations - Operações em lote
   07. ✅ Relationships - Relacionamentos entre modelos
   08. ✅ Advanced Queries - Consultas avançadas
   09. ✅ Utilities - Utilitários diversos
   10. ✅ TypeScript Types - Tipos TypeScript
   11. ✅ AI/ML Features - Funcionalidades de IA/ML
   12. ✅ Event Sourcing - Event Sourcing & CQRS
   13. ✅ Distributed Transactions - Transações distribuídas
   14. ✅ Real-time Subscriptions - Subscriptions em tempo real
   15. ✅ GraphQL Integration - Integração GraphQL
   16. ✅ Performance Monitoring - Monitoramento de performance
   17. ✅ Complete Integration - Integração completa

🎉 Todos os testes passaram! O CassandraORM JS está funcionando perfeitamente.
```

## 🐛 Troubleshooting

### Problemas Comuns

1. **Cassandra não conecta**
   ```bash
   # Verificar se Cassandra está rodando
   docker ps | grep cassandra
   
   # Verificar logs
   docker logs cassandra
   ```

2. **Timeout nos testes**
   ```bash
   # Aumentar timeout no arquivo de teste
   # Ou executar testes individuais
   ```

3. **Keyspace já existe**
   ```bash
   # Os testes criam keyspaces automaticamente
   # Se houver conflito, limpe o Cassandra
   docker restart cassandra
   ```

## 📚 Documentação

- [Documentação Completa](../docs/COMPLETE_DOCUMENTATION.md)
- [Guia de Migração](../docs/MIGRATION_GUIDE.md)
- [Exemplos](../examples/)

## 🤝 Contribuindo

Para adicionar novos testes:

1. Crie um arquivo `XX-feature-name.test.ts`
2. Siga o padrão dos testes existentes
3. Adicione o script no `package.json`
4. Execute `npm run test:playground` para validar

## 📄 Licença

MIT License - veja [LICENSE](../LICENSE) para detalhes.

---

**CassandraORM JS - O ORM mais avançado para Cassandra/ScyllaDB** 🚀
