# Referência da API - CassandraORM JS

## CassandraORM

### Constructor

```typescript
new CassandraORM(options: ConnectionOptions)
```

### Métodos

#### `connect(): Promise<void>`
Conecta ao cluster Cassandra.

#### `model(name: string, schema: Schema, options?: ModelOptions): Model`
Define um novo modelo.

#### `uuid(): string`
Gera um UUID v4.

#### `batch(): BatchQuery`
Cria uma operação em lote.

## Model

### Métodos Estáticos

#### `create(data: object): Promise<ModelInstance>`
Cria uma nova instância.

#### `find(query: object): Promise<ModelInstance[]>`
Busca registros.

#### `findOne(query: object): Promise<ModelInstance | null>`
Busca um registro.

#### `update(query: object, data: object): Promise<void>`
Atualiza registros.

#### `delete(query: object): Promise<void>`
Remove registros.

### Métodos de Instância

#### `save(): Promise<void>`
Salva a instância.

#### `remove(): Promise<void>`
Remove a instância.

## Operadores de Query

- `$eq` - Igual
- `$gt` - Maior que
- `$gte` - Maior ou igual
- `$lt` - Menor que
- `$lte` - Menor ou igual
- `$in` - Está em array

## 🌍 Idiomas

- [English](api-reference.md)
- [Português](api-reference.pt.md) (atual)
