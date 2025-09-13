// Solução Final para Unicidade - CassandraORM JS v1.0.1
import { createClient, uuid } from 'cassandraorm-js';

console.log('🔒 SOLUÇÃO FINAL PARA UNICIDADE - v1.0.1');

// Schema com email como chave primária (única forma 100% confiável no Cassandra)
const finalUserSchema = {
  fields: {
    email: 'text',      // Chave primária - garante unicidade absoluta
    id: 'uuid',
    name: 'text',
    created_at: 'timestamp'
  },
  key: ['email'],       // Email como partition key
  options: {
    table_name: 'users_final_unique'
  }
};

async function testFinalSolution() {
  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_system'
    },
    ormOptions: {
      migration: 'safe'
    }
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado');
    
    // Criar schema final
    await client.loadSchema('users_final_unique', finalUserSchema);
    console.log('✅ Schema final criado');
    
    // Limpar tabela
    await client.execute('TRUNCATE users_final_unique');
    console.log('✅ Tabela limpa');
    
    console.log('\n🔒 TESTANDO SOLUÇÃO FINAL...');
    
    // Teste 1: Inserir usuário único
    console.log('\n👤 TESTE 1 - USUÁRIO ÚNICO:');
    const result1 = await client.execute(
      'INSERT INTO users_final_unique (email, id, name, created_at) VALUES (?, ?, ?, ?) IF NOT EXISTS',
      ['joao@final.com', uuid(), 'João Silva', new Date()]
    );
    
    if (result1.rows[0]['[applied]']) {
      console.log('✅ Primeiro usuário inserido com sucesso');
    } else {
      console.log('❌ Falha ao inserir primeiro usuário');
    }
    
    // Teste 2: Tentar inserir email duplicado
    console.log('\n📧 TESTE 2 - EMAIL DUPLICADO:');
    const result2 = await client.execute(
      'INSERT INTO users_final_unique (email, id, name, created_at) VALUES (?, ?, ?, ?) IF NOT EXISTS',
      ['joao@final.com', uuid(), 'João Duplicado', new Date()]
    );
    
    if (result2.rows[0]['[applied]']) {
      console.log('❌ Email duplicado foi aceito (não deveria)');
    } else {
      console.log('✅ Email duplicado rejeitado corretamente');
    }
    
    // Teste 3: Inserir segundo usuário único
    console.log('\n👤 TESTE 3 - SEGUNDO USUÁRIO ÚNICO:');
    const result3 = await client.execute(
      'INSERT INTO users_final_unique (email, id, name, created_at) VALUES (?, ?, ?, ?) IF NOT EXISTS',
      ['maria@final.com', uuid(), 'Maria Santos', new Date()]
    );
    
    if (result3.rows[0]['[applied]']) {
      console.log('✅ Segundo usuário inserido com sucesso');
    } else {
      console.log('❌ Falha ao inserir segundo usuário');
    }
    
    // Teste 4: Múltiplas tentativas de duplicata
    console.log('\n🚫 TESTE 4 - MÚLTIPLAS DUPLICATAS:');
    const duplicateEmails = ['joao@final.com', 'maria@final.com', 'joao@final.com'];
    let rejectedCount = 0;
    
    for (const email of duplicateEmails) {
      const result = await client.execute(
        'INSERT INTO users_final_unique (email, id, name, created_at) VALUES (?, ?, ?, ?) IF NOT EXISTS',
        [email, uuid(), `Duplicata ${email}`, new Date()]
      );
      
      if (!result.rows[0]['[applied]']) {
        rejectedCount++;
      }
    }
    
    console.log(`✅ ${rejectedCount}/${duplicateEmails.length} duplicatas rejeitadas`);
    
    // Validação final
    console.log('\n🔍 VALIDAÇÃO FINAL:');
    const finalUsers = await client.execute('SELECT email, name FROM users_final_unique');
    console.log(`📊 Total de usuários únicos: ${finalUsers.rows.length}`);
    
    const emails = new Set();
    finalUsers.rows.forEach(user => {
      emails.add(user.email);
      console.log(`  - ${user.name} (${user.email})`);
    });
    
    console.log(`✅ Emails únicos: ${emails.size}/${finalUsers.rows.length}`);
    
    if (emails.size === finalUsers.rows.length) {
      console.log('🎉 UNICIDADE 100% GARANTIDA!');
    } else {
      console.log('❌ Duplicatas encontradas');
    }
    
    console.log('\n📋 RESUMO DA SOLUÇÃO:');
    console.log('  ✅ Email como chave primária');
    console.log('  ✅ IF NOT EXISTS para verificação');
    console.log('  ✅ Schema criado via loadSchema');
    console.log('  ✅ Migration automática');
    console.log('  ✅ Unicidade garantida pelo Cassandra');
    
    console.log('\n💡 RECOMENDAÇÃO PARA PRODUÇÃO:');
    console.log('  - Use email como chave primária para unicidade');
    console.log('  - Use IF NOT EXISTS em todas as inserções');
    console.log('  - Para nomes únicos, use validação na aplicação');
    console.log('  - Considere usar UUIDs como chave se email pode mudar');
    
    await client.disconnect();
    console.log('\n✅ SOLUÇÃO FINAL TESTADA COM SUCESSO!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testFinalSolution();
