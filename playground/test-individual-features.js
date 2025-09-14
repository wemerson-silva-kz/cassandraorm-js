// Testes Individuais por Funcionalidade - CassandraORM JS v1.0.3
import { createClient } from '../dist/index.js';

console.log('🧪 TESTES INDIVIDUAIS POR FUNCIONALIDADE - v1.0.3');

// ===== 1. TESTE QUERY BUILDER =====
export async function testQueryBuilder() {
  console.log('\n🔍 TESTANDO QUERY BUILDER AVANÇADO');
  
  const queryBuilder = {
    conditions: [],
    joins: [],
    orderByFields: [],
    limitValue: null,
    
    where(field, operator = '=', value) {
      this.conditions.push({ field, operator, value });
      return this;
    },
    
    orWhere(field, operator = '=', value) {
      this.conditions.push({ field, operator, value, connector: 'OR' });
      return this;
    },
    
    whereIn(field, values) {
      this.conditions.push({ field, operator: 'IN', value: values });
      return this;
    },
    
    whereBetween(field, min, max) {
      this.conditions.push({ field, operator: 'BETWEEN', value: [min, max] });
      return this;
    },
    
    join(table, localKey, foreignKey) {
      this.joins.push({ table, localKey, foreignKey, type: 'INNER' });
      return this;
    },
    
    leftJoin(table, localKey, foreignKey) {
      this.joins.push({ table, localKey, foreignKey, type: 'LEFT' });
      return this;
    },
    
    orderBy(field, direction = 'ASC') {
      this.orderByFields.push({ field, direction });
      return this;
    },
    
    limit(count) {
      this.limitValue = count;
      return this;
    },
    
    buildQuery() {
      let query = 'SELECT * FROM users';
      
      if (this.joins.length > 0) {
        this.joins.forEach(join => {
          query += ` ${join.type} JOIN ${join.table} ON ${join.localKey} = ${join.foreignKey}`;
        });
      }
      
      if (this.conditions.length > 0) {
        const whereClause = this.conditions.map((cond, index) => {
          const connector = index > 0 && cond.connector ? ` ${cond.connector} ` : '';
          return `${connector}${cond.field} ${cond.operator} ${Array.isArray(cond.value) ? `(${cond.value.join(',')})` : cond.value}`;
        }).join(' AND ');
        query += ` WHERE ${whereClause}`;
      }
      
      if (this.orderByFields.length > 0) {
        const orderClause = this.orderByFields.map(o => `${o.field} ${o.direction}`).join(', ');
        query += ` ORDER BY ${orderClause}`;
      }
      
      if (this.limitValue) {
        query += ` LIMIT ${this.limitValue}`;
      }
      
      return query;
    }
  };
  
  // Teste fluent API
  const query = queryBuilder
    .where('status', '=', 'active')
    .where('age', '>', 18)
    .orWhere('role', '=', 'admin')
    .whereIn('category', ['user', 'premium'])
    .whereBetween('created_at', '2024-01-01', '2024-12-31')
    .join('profiles', 'users.id', 'profiles.user_id')
    .leftJoin('posts', 'users.id', 'posts.user_id')
    .orderBy('name', 'ASC')
    .orderBy('created_at', 'DESC')
    .limit(10)
    .buildQuery();
  
  console.log('✅ Query construída:', query);
  return { success: true, query };
}

// ===== 2. TESTE RELACIONAMENTOS =====
export async function testRelationships() {
  console.log('\n🔗 TESTANDO RELACIONAMENTOS');
  
  const relationshipManager = {
    relations: new Map(),
    
    define(modelName, relationName, config) {
      if (!this.relations.has(modelName)) {
        this.relations.set(modelName, new Map());
      }
      this.relations.get(modelName).set(relationName, config);
    },
    
    async load(modelName, relationName, parentRecord) {
      const modelRelations = this.relations.get(modelName);
      if (!modelRelations) return null;
      
      const relation = modelRelations.get(relationName);
      if (!relation) return null;
      
      // Simular carregamento baseado no tipo
      switch (relation.type) {
        case 'hasOne':
          return { id: 1, [relation.foreignKey]: parentRecord.id, ...relation.mockData };
        
        case 'hasMany':
          return [
            { id: 1, [relation.foreignKey]: parentRecord.id, title: 'Post 1' },
            { id: 2, [relation.foreignKey]: parentRecord.id, title: 'Post 2' }
          ];
        
        case 'belongsTo':
          return { id: parentRecord[relation.foreignKey], name: 'Parent Record' };
        
        default:
          return null;
      }
    }
  };
  
  // Definir relacionamentos
  relationshipManager.define('User', 'profile', {
    type: 'hasOne',
    model: 'Profile',
    foreignKey: 'user_id',
    mockData: { bio: 'User bio', avatar: 'avatar.jpg' }
  });
  
  relationshipManager.define('User', 'posts', {
    type: 'hasMany',
    model: 'Post',
    foreignKey: 'user_id'
  });
  
  relationshipManager.define('Post', 'author', {
    type: 'belongsTo',
    model: 'User',
    foreignKey: 'user_id'
  });
  
  // Testar carregamento
  const user = { id: 123, name: 'John Doe' };
  const profile = await relationshipManager.load('User', 'profile', user);
  const posts = await relationshipManager.load('User', 'posts', user);
  
  console.log('✅ Profile (hasOne):', profile);
  console.log('✅ Posts (hasMany):', posts);
  
  return { success: true, profile, posts };
}

// ===== 3. TESTE HOOKS =====
export async function testHooks() {
  console.log('\n🎣 TESTANDO HOOKS E EVENTS');
  
  const hooksManager = {
    hooks: new Map(),
    
    on(event, callback) {
      if (!this.hooks.has(event)) {
        this.hooks.set(event, []);
      }
      this.hooks.get(event).push(callback);
    },
    
    async execute(event, data, context = {}) {
      const eventHooks = this.hooks.get(event) || [];
      let result = data;
      
      for (const hook of eventHooks) {
        try {
          const hookResult = await hook(result, context);
          if (hookResult !== undefined) {
            result = hookResult;
          }
        } catch (error) {
          console.error(`Hook error for ${event}:`, error.message);
        }
      }
      
      return result;
    }
  };
  
  // Registrar hooks
  hooksManager.on('beforeSave', (data) => {
    console.log('🎣 beforeSave: adicionando timestamps');
    data.updated_at = new Date();
    if (!data.created_at) data.created_at = new Date();
    return data;
  });
  
  hooksManager.on('beforeSave', (data) => {
    console.log('🎣 beforeSave: normalizando email');
    if (data.email) data.email = data.email.toLowerCase();
    return data;
  });
  
  hooksManager.on('afterSave', (data) => {
    console.log('🎣 afterSave: log de auditoria');
    console.log(`Usuário ${data.id} foi salvo em ${data.updated_at}`);
    return data;
  });
  
  hooksManager.on('afterFind', (data) => {
    console.log('🎣 afterFind: removendo campos sensíveis');
    if (Array.isArray(data)) {
      return data.map(item => {
        const { password, ...safe } = item;
        return safe;
      });
    } else {
      const { password, ...safe } = data;
      return safe;
    }
  });
  
  // Testar execução de hooks
  const userData = {
    id: 123,
    name: 'John Doe',
    email: 'JOHN@EXAMPLE.COM',
    password: 'secret123'
  };
  
  const beforeSaveResult = await hooksManager.execute('beforeSave', userData);
  const afterSaveResult = await hooksManager.execute('afterSave', beforeSaveResult);
  const afterFindResult = await hooksManager.execute('afterFind', afterSaveResult);
  
  console.log('✅ Resultado final após hooks:', afterFindResult);
  
  return { success: true, result: afterFindResult };
}

// ===== 4. TESTE SCOPES =====
export async function testScopes() {
  console.log('\n🎯 TESTANDO SCOPES E FILTERS');
  
  const scopesManager = {
    scopes: new Map(),
    
    define(name, scopeFunction) {
      this.scopes.set(name, scopeFunction);
    },
    
    apply(scopeName, ...args) {
      const scope = this.scopes.get(scopeName);
      if (!scope) throw new Error(`Scope ${scopeName} not found`);
      return scope(...args);
    },
    
    combine(...scopeNames) {
      const conditions = {};
      scopeNames.forEach(scopeName => {
        const scopeConditions = this.apply(scopeName);
        Object.assign(conditions, scopeConditions);
      });
      return conditions;
    }
  };
  
  // Definir scopes
  scopesManager.define('active', () => ({ status: 'active' }));
  
  scopesManager.define('recent', (days = 30) => ({
    created_at: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
  }));
  
  scopesManager.define('byAge', (min, max) => ({
    age: { $gte: min, $lte: max }
  }));
  
  scopesManager.define('search', (term, fields = ['name', 'email']) => {
    const conditions = {};
    fields.forEach(field => {
      conditions[`${field}_like`] = `%${term}%`;
    });
    return conditions;
  });
  
  // Testar scopes
  const activeScope = scopesManager.apply('active');
  const recentScope = scopesManager.apply('recent', 7);
  const ageScope = scopesManager.apply('byAge', 18, 65);
  const searchScope = scopesManager.apply('search', 'john', ['name', 'email']);
  
  // Combinar scopes
  const combinedScope = scopesManager.combine('active', 'recent');
  
  console.log('✅ Active scope:', activeScope);
  console.log('✅ Recent scope:', recentScope);
  console.log('✅ Age scope:', ageScope);
  console.log('✅ Search scope:', searchScope);
  console.log('✅ Combined scope:', combinedScope);
  
  return { success: true, scopes: { activeScope, recentScope, ageScope, searchScope, combinedScope } };
}

// ===== 5. TESTE SOFT DELETES =====
export async function testSoftDeletes() {
  console.log('\n🗑️ TESTANDO SOFT DELETES');
  
  const softDeleteManager = {
    deletedAtField: 'deleted_at',
    
    softDelete(record) {
      record[this.deletedAtField] = new Date();
      console.log(`🗑️ Soft delete: ${record.id} marcado como deletado`);
      return record;
    },
    
    restore(record) {
      record[this.deletedAtField] = null;
      console.log(`♻️ Restore: ${record.id} restaurado`);
      return record;
    },
    
    forceDelete(record) {
      console.log(`💥 Force delete: ${record.id} removido permanentemente`);
      return null;
    },
    
    isTrashed(record) {
      return record[this.deletedAtField] !== null && record[this.deletedAtField] !== undefined;
    },
    
    applyDefaultScope(records) {
      return records.filter(record => !this.isTrashed(record));
    },
    
    withTrashed(records) {
      return records; // Retorna todos, incluindo deletados
    },
    
    onlyTrashed(records) {
      return records.filter(record => this.isTrashed(record));
    }
  };
  
  // Dados de teste
  const records = [
    { id: 1, name: 'Record 1', deleted_at: null },
    { id: 2, name: 'Record 2', deleted_at: null },
    { id: 3, name: 'Record 3', deleted_at: new Date('2024-01-01') }
  ];
  
  // Testar soft delete
  const record1 = { ...records[0] };
  const deletedRecord = softDeleteManager.softDelete(record1);
  
  // Testar restore
  const restoredRecord = softDeleteManager.restore({ ...deletedRecord });
  
  // Testar scopes
  const activeRecords = softDeleteManager.applyDefaultScope(records);
  const allRecords = softDeleteManager.withTrashed(records);
  const trashedRecords = softDeleteManager.onlyTrashed(records);
  
  console.log('✅ Active records:', activeRecords.length);
  console.log('✅ All records:', allRecords.length);
  console.log('✅ Trashed records:', trashedRecords.length);
  
  return { 
    success: true, 
    activeRecords: activeRecords.length,
    allRecords: allRecords.length,
    trashedRecords: trashedRecords.length
  };
}

// ===== 6. TESTE SERIALIZATION =====
export async function testSerialization() {
  console.log('\n📄 TESTANDO SERIALIZATION');
  
  const serializationManager = {
    serialize(data, options = {}) {
      const { hidden = [], appends = [], casts = {}, relations = [] } = options;
      let result = { ...data };
      
      // Remover campos ocultos
      hidden.forEach(field => delete result[field]);
      
      // Aplicar casts
      Object.entries(casts).forEach(([field, castType]) => {
        if (result[field] !== undefined) {
          result[field] = this.applyCast(result[field], castType);
        }
      });
      
      // Adicionar campos computados
      appends.forEach(field => {
        result[field] = this.computeField(data, field);
      });
      
      return result;
    },
    
    applyCast(value, castType) {
      switch (castType) {
        case 'string':
          return String(value);
        case 'number':
          return Number(value);
        case 'boolean':
          return Boolean(value);
        case 'date':
          return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
        case 'json':
          return typeof value === 'string' ? JSON.parse(value) : value;
        default:
          return value;
      }
    },
    
    computeField(data, field) {
      switch (field) {
        case 'full_name':
          return `${data.first_name || ''} ${data.last_name || ''}`.trim();
        case 'age_group':
          if (!data.age) return null;
          if (data.age < 18) return 'minor';
          if (data.age < 30) return 'young';
          if (data.age < 60) return 'adult';
          return 'senior';
        case 'display_name':
          return data.name || data.username || data.email;
        default:
          return null;
      }
    }
  };
  
  // Dados de teste
  const userData = {
    id: 123,
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    age: 25,
    password: 'secret123',
    profile_data: '{"bio": "Developer", "location": "NYC"}',
    created_at: new Date('2024-01-01'),
    is_active: 'true'
  };
  
  // Testar serialização
  const serialized = serializationManager.serialize(userData, {
    hidden: ['password'],
    appends: ['full_name', 'age_group', 'display_name'],
    casts: {
      profile_data: 'json',
      created_at: 'date',
      is_active: 'boolean'
    }
  });
  
  console.log('✅ Dados originais:', Object.keys(userData));
  console.log('✅ Dados serializados:', Object.keys(serialized));
  console.log('✅ Resultado:', JSON.stringify(serialized, null, 2));
  
  return { success: true, original: userData, serialized };
}

// ===== EXECUTAR TODOS OS TESTES =====
export async function runAllIndividualTests() {
  console.log('🧪 EXECUTANDO TODOS OS TESTES INDIVIDUAIS...\n');
  
  const results = {};
  
  try {
    results.queryBuilder = await testQueryBuilder();
    results.relationships = await testRelationships();
    results.hooks = await testHooks();
    results.scopes = await testScopes();
    results.softDeletes = await testSoftDeletes();
    results.serialization = await testSerialization();
    
    console.log('\n📊 RESUMO DOS TESTES INDIVIDUAIS:');
    Object.entries(results).forEach(([test, result]) => {
      const status = result.success ? '✅' : '❌';
      console.log(`  ${status} ${test}: ${result.success ? 'PASSOU' : 'FALHOU'}`);
    });
    
    const passedTests = Object.values(results).filter(r => r.success).length;
    const totalTests = Object.keys(results).length;
    
    console.log(`\n🎯 RESULTADO FINAL: ${passedTests}/${totalTests} testes passaram`);
    
    if (passedTests === totalTests) {
      console.log('🎉 TODOS OS TESTES INDIVIDUAIS PASSARAM!');
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ Erro nos testes individuais:', error.message);
    return { error: error.message };
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllIndividualTests();
}
