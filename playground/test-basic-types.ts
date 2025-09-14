#!/usr/bin/env bun
import { 
  createClient, 
  CassandraTypes,
  type CassandraDataType 
} from '../src/index.js';

async function testBasicTypes() {
  console.log('🗃️ Demonstração dos Tipos do Cassandra\n');

  // Mostrar todos os tipos disponíveis
  console.log('📋 TIPOS DE DADOS DO CASSANDRA DISPONÍVEIS:\n');

  console.log('🔢 TIPOS NUMÉRICOS:');
  console.log('   • tinyint    - 8-bit signed integer (-128 to 127)');
  console.log('   • smallint   - 16-bit signed integer (-32,768 to 32,767)');
  console.log('   • int        - 32-bit signed integer');
  console.log('   • bigint     - 64-bit signed long');
  console.log('   • varint     - arbitrary precision integer');
  console.log('   • float      - 32-bit IEEE-754 floating point');
  console.log('   • double     - 64-bit IEEE-754 floating point');
  console.log('   • decimal    - variable-precision decimal');

  console.log('\n📝 TIPOS DE TEXTO:');
  console.log('   • ascii      - ASCII character string');
  console.log('   • text       - UTF8 encoded string');
  console.log('   • varchar    - UTF8 encoded string (alias for text)');

  console.log('\n📅 TIPOS DE DATA/HORA:');
  console.log('   • timestamp  - date and time with millisecond precision');
  console.log('   • date       - date without time');
  console.log('   • time       - time without date');
  console.log('   • duration   - duration with nanosecond precision');

  console.log('\n🆔 TIPOS UUID:');
  console.log('   • uuid       - type 1 or type 4 UUID');
  console.log('   • timeuuid   - type 1 UUID (time-based)');

  console.log('\n📦 TIPOS DE COLEÇÃO:');
  console.log('   • set<type>     - unordered unique collection');
  console.log('   • list<type>    - ordered collection with duplicates');
  console.log('   • map<k,v>      - key-value pairs');
  console.log('   • tuple<types>  - fixed-length sequence');

  console.log('\n🔧 TIPOS ESPECIAIS:');
  console.log('   • boolean    - true or false');
  console.log('   • blob       - arbitrary bytes');
  console.log('   • inet       - IPv4 or IPv6 address');
  console.log('   • counter    - distributed counter');
  console.log('   • json       - JSON data (Cassandra 4.0+)');
  console.log('   • frozen<T>  - frozen user-defined type');

  console.log('\n🔧 HELPERS DISPONÍVEIS:');
  console.log(`
// Tipos básicos
CassandraTypes.UUID        // 'uuid'
CassandraTypes.TEXT        // 'text'
CassandraTypes.INT         // 'int'
CassandraTypes.DECIMAL     // 'decimal'
CassandraTypes.BOOLEAN     // 'boolean'
CassandraTypes.TIMESTAMP   // 'timestamp'

// Helpers para coleções
CassandraTypes.set('text')           // 'set<text>'
CassandraTypes.list('int')           // 'list<int>'
CassandraTypes.map('text', 'text')   // 'map<text,text>'
CassandraTypes.tuple('double,double') // 'tuple<double,double>'
CassandraTypes.frozen('address_type') // 'frozen<address_type>'
`);

  console.log('\n💡 EXEMPLOS DE USO:');
  console.log(`
// Exemplo 1: Schema básico
const userSchema = {
  fields: {
    id: CassandraTypes.UUID,
    email: { type: CassandraTypes.TEXT, unique: true },
    name: CassandraTypes.TEXT,
    age: CassandraTypes.INT,
    active: { type: CassandraTypes.BOOLEAN, default: true },
    created_at: CassandraTypes.TIMESTAMP
  },
  key: ['id']
};

// Exemplo 2: Schema com coleções
const productSchema = {
  fields: {
    id: CassandraTypes.UUID,
    name: CassandraTypes.TEXT,
    price: CassandraTypes.DECIMAL,
    tags: CassandraTypes.set(CassandraTypes.TEXT),
    images: CassandraTypes.list(CassandraTypes.TEXT),
    attributes: CassandraTypes.map(CassandraTypes.TEXT, CassandraTypes.TEXT)
  },
  key: ['id']
};

// Exemplo 3: Sintaxe direta
const directSchema = {
  fields: {
    id: 'uuid',
    name: 'text',
    tags: 'set<text>',
    scores: 'list<int>',
    metadata: 'map<text,text>'
  },
  key: ['id']
};
`);

  console.log('\n🎯 VALIDAÇÕES SUPORTADAS:');
  console.log(`
const validatedSchema = {
  fields: {
    id: 'uuid',
    email: { 
      type: 'text', 
      unique: true, 
      validate: { 
        required: true, 
        isEmail: true 
      } 
    },
    age: { 
      type: 'int', 
      validate: { 
        min: 0, 
        max: 120 
      } 
    },
    name: { 
      type: 'text', 
      validate: { 
        required: true, 
        minLength: 2, 
        maxLength: 50 
      } 
    }
  },
  key: ['id']
};
`);

  console.log('\n🚀 TESTE PRÁTICO:');
  
  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: `test_demo_${Date.now()}`
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe'
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao Cassandra');

    const User = await client.loadSchema('users', {
      fields: {
        id: CassandraTypes.UUID,
        email: { type: CassandraTypes.TEXT, unique: true },
        name: CassandraTypes.TEXT,
        active: { type: CassandraTypes.BOOLEAN, default: true },
        created_at: CassandraTypes.TIMESTAMP
      },
      key: ['id']
    });

    const user = await User.create({
      id: client.uuid(),
      email: 'demo@example.com',
      name: 'Demo User',
      active: true,
      created_at: new Date()
    });

    console.log('✅ Usuário criado com tipos do Cassandra:', user.name);
    console.log('\n🎉 Tipos do Cassandra implementados e funcionando!');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
  } finally {
    await client.disconnect();
    console.log('\n👋 Desconectado do Cassandra');
  }
}

// Executar demonstração
testBasicTypes();
