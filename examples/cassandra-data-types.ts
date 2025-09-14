#!/usr/bin/env bun
import { 
  createClient, 
  CassandraTypes, 
  CassandraTypeExamples,
  type CassandraModelSchema,
  type CassandraDataType,
  type CassandraFieldDefinition
} from '../src/index.js';

async function demonstrateCassandraTypes() {
  console.log('🗃️ Demonstração dos Tipos de Dados do Cassandra\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: `cassandra_types_${Date.now()}`
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe'
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao Cassandra\n');

    // === EXEMPLO 1: Schema com todos os tipos básicos ===
    console.log('📋 1. Schema com tipos básicos do Cassandra:');
    
    const basicTypesSchema: CassandraModelSchema = {
      fields: {
        // Numeric types
        id: CassandraTypes.UUID,
        tiny_number: CassandraTypes.TINYINT,
        small_number: CassandraTypes.SMALLINT,
        regular_number: CassandraTypes.INT,
        big_number: CassandraTypes.BIGINT,
        variable_int: CassandraTypes.VARINT,
        float_number: CassandraTypes.FLOAT,
        double_number: CassandraTypes.DOUBLE,
        precise_decimal: CassandraTypes.DECIMAL,
        
        // String types
        ascii_text: CassandraTypes.ASCII,
        utf8_text: CassandraTypes.TEXT,
        varchar_text: CassandraTypes.VARCHAR,
        
        // Binary
        binary_data: CassandraTypes.BLOB,
        
        // Boolean
        is_active: CassandraTypes.BOOLEAN,
        
        // Date/Time
        created_timestamp: CassandraTypes.TIMESTAMP,
        birth_date: CassandraTypes.DATE,
        login_time: CassandraTypes.TIME,
        session_duration: CassandraTypes.DURATION,
        
        // UUID types
        time_uuid: CassandraTypes.TIMEUUID,
        
        // Network
        ip_address: CassandraTypes.INET,
        
        // Counter
        view_count: CassandraTypes.COUNTER,
        
        // JSON (Cassandra 4.0+)
        metadata: CassandraTypes.JSON
      },
      key: ['id']
    };

    console.log('   ✅ Tipos numéricos: tinyint, smallint, int, bigint, varint, float, double, decimal');
    console.log('   ✅ Tipos de texto: ascii, text, varchar');
    console.log('   ✅ Tipos especiais: boolean, blob, timestamp, date, time, duration');
    console.log('   ✅ Tipos UUID: uuid, timeuuid');
    console.log('   ✅ Tipos de rede: inet');
    console.log('   ✅ Tipos especiais: counter, json');

    // === EXEMPLO 2: Schema com coleções ===
    console.log('\n📋 2. Schema com tipos de coleção:');
    
    const collectionsSchema: CassandraModelSchema = {
      fields: {
        id: CassandraTypes.UUID,
        
        // Collections usando helpers
        tags: CassandraTypes.set(CassandraTypes.TEXT),
        scores: CassandraTypes.list(CassandraTypes.INT),
        attributes: CassandraTypes.map(CassandraTypes.TEXT, CassandraTypes.TEXT),
        
        // Collections com sintaxe direta
        categories: 'set<text>' as CassandraDataType,
        numbers: 'list<int>' as CassandraDataType,
        key_values: 'map<text,decimal>' as CassandraDataType,
        
        // Tuple e Frozen
        coordinates: CassandraTypes.tuple('double,double'),
        address: CassandraTypes.frozen('address_type')
      },
      key: ['id']
    };

    console.log('   ✅ Set: set<text> - coleção única não ordenada');
    console.log('   ✅ List: list<int> - coleção ordenada com duplicatas');
    console.log('   ✅ Map: map<text,text> - pares chave-valor');
    console.log('   ✅ Tuple: tuple<double,double> - sequência de tipos fixos');
    console.log('   ✅ Frozen: frozen<address_type> - tipo definido pelo usuário');

    // === EXEMPLO 3: Schema real de e-commerce ===
    console.log('\n📋 3. Exemplo real - Schema de Produto E-commerce:');
    
    const Product = await client.loadSchema('products', {
      fields: {
        id: 'uuid',
        sku: { type: 'text', unique: true },
        name: { type: 'text', validate: { required: true } },
        description: 'text',
        price: 'decimal',
        category: 'text',
        tags: 'set<text>',
        images: 'list<text>',
        attributes: 'map<text,text>',
        in_stock: { type: 'boolean', default: true },
        stock_count: 'int',
        weight: 'float',
        dimensions: 'tuple<double,double,double>', // width, height, depth
        metadata: 'json',
        created_at: 'timestamp',
        updated_at: 'timestamp'
      },
      key: ['id'],
      clustering_order: { created_at: 'DESC' }
    });

    console.log('   ✅ Schema de produto criado com tipos variados');

    // Criar produto de exemplo
    const product = await Product.create({
      id: client.uuid(),
      sku: 'LAPTOP-001',
      name: 'Laptop Dell XPS 13',
      description: 'Laptop premium para desenvolvedores',
      price: 2499.99,
      category: 'Electronics',
      tags: new Set(['laptop', 'dell', 'premium']),
      images: ['image1.jpg', 'image2.jpg'],
      attributes: new Map([
        ['brand', 'Dell'],
        ['model', 'XPS 13'],
        ['color', 'Silver']
      ]),
      in_stock: true,
      stock_count: 10,
      weight: 1.2,
      dimensions: [30.4, 19.9, 1.4], // tuple como array
      metadata: JSON.stringify({ warranty: '2 years', origin: 'USA' }),
      created_at: new Date(),
      updated_at: new Date()
    });

    console.log('   ✅ Produto criado:', product.name);

    // === EXEMPLO 4: Schema com validações avançadas ===
    console.log('\n📋 4. Schema com validações avançadas:');
    
    const User = await client.loadSchema('users', {
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
        username: { 
          type: 'text', 
          unique: true, 
          validate: { 
            required: true, 
            minLength: 3, 
            maxLength: 20 
          } 
        },
        age: { 
          type: 'int', 
          validate: { 
            min: 13, 
            max: 120 
          } 
        },
        bio: { 
          type: 'text', 
          validate: { 
            maxLength: 500 
          } 
        },
        preferences: 'map<text,text>',
        interests: 'set<text>',
        login_history: 'list<timestamp>',
        is_verified: { type: 'boolean', default: false },
        created_at: 'timestamp'
      },
      key: ['id']
    });

    console.log('   ✅ Schema de usuário com validações criado');

    // === RESUMO DOS TIPOS ===
    console.log('\n📊 RESUMO DOS TIPOS DO CASSANDRA:');
    console.log('\n🔢 Tipos Numéricos:');
    console.log('   • tinyint    - 8-bit signed integer (-128 to 127)');
    console.log('   • smallint   - 16-bit signed integer (-32,768 to 32,767)');
    console.log('   • int        - 32-bit signed integer');
    console.log('   • bigint     - 64-bit signed long');
    console.log('   • varint     - arbitrary precision integer');
    console.log('   • float      - 32-bit IEEE-754 floating point');
    console.log('   • double     - 64-bit IEEE-754 floating point');
    console.log('   • decimal    - variable-precision decimal');

    console.log('\n📝 Tipos de Texto:');
    console.log('   • ascii      - ASCII character string');
    console.log('   • text       - UTF8 encoded string');
    console.log('   • varchar    - UTF8 encoded string (alias for text)');

    console.log('\n📅 Tipos de Data/Hora:');
    console.log('   • timestamp  - date and time with millisecond precision');
    console.log('   • date       - date without time');
    console.log('   • time       - time without date');
    console.log('   • duration   - duration with nanosecond precision');

    console.log('\n🆔 Tipos UUID:');
    console.log('   • uuid       - type 1 or type 4 UUID');
    console.log('   • timeuuid   - type 1 UUID (time-based)');

    console.log('\n📦 Tipos de Coleção:');
    console.log('   • set<type>     - unordered unique collection');
    console.log('   • list<type>    - ordered collection with duplicates');
    console.log('   • map<k,v>      - key-value pairs');
    console.log('   • tuple<types>  - fixed-length sequence');

    console.log('\n🔧 Tipos Especiais:');
    console.log('   • boolean    - true or false');
    console.log('   • blob       - arbitrary bytes');
    console.log('   • inet       - IPv4 or IPv6 address');
    console.log('   • counter    - distributed counter');
    console.log('   • json       - JSON data (Cassandra 4.0+)');
    console.log('   • frozen<T>  - frozen user-defined type');

    console.log('\n💡 Dicas de Uso:');
    console.log('   • Use CassandraTypes helpers para autocompletar');
    console.log('   • Combine com validações para dados consistentes');
    console.log('   • Collections são ideais para dados relacionados');
    console.log('   • UUID/TimeUUID para chaves primárias distribuídas');
    console.log('   • Counter para métricas distribuídas');

    console.log('\n🎉 Demonstração completa dos tipos do Cassandra!');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
  } finally {
    await client.disconnect();
    console.log('\n👋 Desconectado do Cassandra');
  }
}

// Executar demonstração
demonstrateCassandraTypes();
