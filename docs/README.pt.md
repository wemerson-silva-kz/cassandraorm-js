# Documentação CassandraORM JS

Um ORM moderno e otimizado para Apache Cassandra e ScyllaDB com suporte nativo para TypeScript, ES6+ e recursos avançados.

## 🚀 Características

- **TypeScript First** - Suporte nativo com tipos completos
- **ES6+ Modules** - Import/export moderno
- **Async/Await** - API totalmente baseada em Promises
- **Performance** - Otimizações para alta performance
- **Developer Experience** - Melhor DX com IntelliSense completo

## 📦 Instalação

```bash
npm install cassandraorm-js
```

## ⚡ Início Rápido

```typescript
import { CassandraORM } from 'cassandraorm-js';

const orm = new CassandraORM({
  contactPoints: ['127.0.0.1'],
  localDataCenter: 'datacenter1',
  keyspace: 'myapp'
});

// Definir modelo
const User = orm.model('User', {
  id: 'uuid',
  name: 'text',
  email: 'text',
  createdAt: 'timestamp'
}, {
  key: ['id'],
  indexes: ['email']
});

// Usar o modelo
const user = await User.create({
  id: orm.uuid(),
  name: 'João Silva',
  email: 'joao@email.com',
  createdAt: new Date()
});
```

## 📚 Estrutura da Documentação

- [Guia de Instalação](installation.pt.md) - Como instalar e configurar
- [Guia de Migração](migration.pt.md) - Migrar do Express-Cassandra
- [Referência da API](api-reference.pt.md) - Documentação completa da API
- [Exemplos](examples.pt.md) - Exemplos práticos

## Recursos

✅ Suporte para Cassandra 4.x, 3.x e ScyllaDB 5.x  
✅ Operações CRUD completas  
✅ Validação de tipos de dados  
✅ Suporte para coleções e tipos avançados  
✅ Views materializadas e índices  
✅ Queries complexas com paginação  
✅ Tipos/funções/agregados definidos pelo usuário  
✅ Operações em lote atômicas  
✅ Hooks para save/update/delete  
✅ Suporte completo a Promises  
✅ Migrações automáticas (experimental)  
✅ Import/export de dados (experimental)  

## 🌍 Idiomas

- [English](README.md)
- [Português](README.pt.md) (atual)

## Suporte

- [GitHub Issues](https://github.com/wemerson-silva-kz/cassandraorm-js/issues)
- [Pacote NPM](https://www.npmjs.com/package/cassandraorm-js)

## Licença

Licença MIT
