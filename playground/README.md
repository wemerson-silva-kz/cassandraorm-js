# 🎮 Playground - CassandraORM JS

Testes essenciais para validar as funcionalidades principais do CassandraORM JS.

## 🚀 Pré-requisitos

```bash
# Instalar Bun
curl -fsSL https://bun.sh/install | bash

# Iniciar Cassandra
docker run -d --name cassandra -p 9042:9042 cassandra:latest
```

## 🧪 Testes Disponíveis

### 1. ⚡ Teste Rápido
```bash
bun run test:quick
```
**Valida:** Conexão básica, schema simples, operações essenciais

### 2. 🔒 Teste de Campos Unique
```bash
bun run test:unique
```
**Valida:** Campos únicos (email, username, phone), validação de duplicatas

### 3. 📋 Teste CRUD Completo
```bash
bun run test:crud
```
**Valida:** Create, Read, Update, Delete, batch operations, timestamps

### 4. 🎯 Teste Completo do ORM
```bash
bun run test:complete
```
**Valida:** Todas as funcionalidades do ORM em um teste abrangente

## 🎯 Teste Completo - Funcionalidades

O `test:complete` valida **10 categorias principais**:

1. **🔧 CRUD Básico** - Create, Read, Update, Delete
2. **🔒 Campos Unique** - Validação de duplicatas
3. **🔄 Upsert** - Insert ou Update automático
4. **📦 Batch Operations** - CreateMany com ignoreDuplicates
5. **🔗 Relacionamentos** - Modelos relacionados
6. **🔍 Queries Avançadas** - Filtros e buscas
7. **🔧 Utilities** - UUID, TimeUUID, Stats
8. **📊 Batch Queries** - Múltiplas operações
9. **📡 Streaming** - Processamento de dados
10. **🗑️ Delete** - Remoção de registros

## 🔒 Sintaxes de Campos Unique

Ambas as sintaxes funcionam:

```typescript
// Sintaxe 1: No campo individual
const schema = {
  fields: {
    email: { type: 'text', unique: true },
    username: { type: 'text', unique: true }
  }
};

// Sintaxe 2: No array unique
const schema = {
  fields: {
    email: 'text',
    username: 'text'
  },
  unique: ['email', 'username']
};

// Sintaxe 3: Mista (ambas juntas)
const schema = {
  fields: {
    email: { type: 'text', unique: true },
    username: 'text'
  },
  unique: ['username'] // Ambos serão unique
};
```

## 🔄 Upsert e Batch

```typescript
// Upsert - cria ou atualiza
const user = await User.create({
  email: 'john@example.com',
  name: 'John Updated'
}, { upsert: true });

// Batch ignorando duplicatas
const users = await User.createMany([
  { email: 'user1@example.com', name: 'User 1' },
  { email: 'existing@example.com', name: 'Duplicate' }, // Ignorado
  { email: 'user3@example.com', name: 'User 3' }
], { ignoreDuplicates: true });
```

## 📊 Exemplo de Saída

```
🎯 Teste Completo do ORM - CassandraORM JS
✅ 1. CRUD Básico (Create, Read, Update, Delete)
✅ 2. Campos Unique com validação
✅ 3. Upsert (insert ou update)
✅ 4. Batch Operations (createMany)
✅ 5. Relacionamentos entre modelos
✅ 6. Queries avançadas com filtros
✅ 7. Utilities (UUID, TimeUUID, Stats)
✅ 8. Batch Queries (múltiplas operações)
✅ 9. Streaming de dados
✅ 10. Delete de registros
🏆 RESULTADO: TODOS OS RECURSOS DO ORM FUNCIONANDO!
```

## 🎯 Como Usar

1. **Começar com teste rápido**: `bun run test:quick`
2. **Testar campos unique**: `bun run test:unique`  
3. **Testar CRUD completo**: `bun run test:crud`
4. **Teste completo do ORM**: `bun run test:complete`

**Happy Testing! 🚀**
