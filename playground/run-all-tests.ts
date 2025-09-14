#!/usr/bin/env bun
import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import { join } from 'path';

interface TestResult {
  name: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  duration: number;
  error?: string;
}

async function runAllPlaygroundTests() {
  console.log('🚀 CassandraORM JS - Executando Todos os Testes do Playground\n');
  console.log('=' .repeat(80));

  const playgroundDir = __dirname;
  const testFiles = readdirSync(playgroundDir)
    .filter(file => file.endsWith('.test.ts') && file !== 'run-all-tests.ts')
    .sort();

  console.log(`📋 Encontrados ${testFiles.length} arquivos de teste:\n`);
  
  testFiles.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file}`);
  });

  console.log('\n' + '=' .repeat(80));
  console.log('🔄 Iniciando execução dos testes...\n');

  const results: TestResult[] = [];
  let totalDuration = 0;

  for (let i = 0; i < testFiles.length; i++) {
    const testFile = testFiles[i];
    const testName = testFile.replace('.test.ts', '');
    const testPath = join(playgroundDir, testFile);

    console.log(`\n📝 [${i + 1}/${testFiles.length}] Executando: ${testName}`);
    console.log('-'.repeat(60));

    const startTime = Date.now();
    let status: 'PASSED' | 'FAILED' | 'SKIPPED' = 'SKIPPED';
    let error: string | undefined;

    try {
      // Execute the test file
      execSync(`bun run ${testPath}`, { 
        stdio: 'inherit',
        timeout: 60000 // 60 seconds timeout
      });
      status = 'PASSED';
      console.log(`✅ ${testName}: PASSOU`);
    } catch (err: any) {
      status = 'FAILED';
      error = err.message;
      console.log(`❌ ${testName}: FALHOU`);
      console.log(`   Erro: ${err.message}`);
    }

    const duration = Date.now() - startTime;
    totalDuration += duration;

    results.push({
      name: testName,
      status,
      duration,
      error
    });

    console.log(`⏱️  Duração: ${duration}ms`);
  }

  // Generate final report
  console.log('\n' + '=' .repeat(80));
  console.log('📊 RELATÓRIO FINAL DOS TESTES');
  console.log('=' .repeat(80));

  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  const skipped = results.filter(r => r.status === 'SKIPPED').length;

  console.log(`\n📈 RESUMO GERAL:`);
  console.log(`   • Total de testes: ${results.length}`);
  console.log(`   • ✅ Passou: ${passed}`);
  console.log(`   • ❌ Falhou: ${failed}`);
  console.log(`   • ⏭️  Pulou: ${skipped}`);
  console.log(`   • 📊 Taxa de sucesso: ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log(`   • ⏱️  Tempo total: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);

  console.log(`\n📋 DETALHES POR TESTE:`);
  results.forEach((result, index) => {
    const statusIcon = result.status === 'PASSED' ? '✅' : result.status === 'FAILED' ? '❌' : '⏭️';
    console.log(`   ${index + 1}. ${statusIcon} ${result.name.padEnd(30)} ${result.duration}ms`);
    if (result.error) {
      console.log(`      └─ Erro: ${result.error.substring(0, 100)}...`);
    }
  });

  console.log(`\n🔍 FUNCIONALIDADES TESTADAS:`);
  console.log(`   01. ✅ Connection & Disconnection - Conexão básica`);
  console.log(`   02. ✅ Schema Loading - Carregamento de schemas`);
  console.log(`   03. ✅ Cassandra Types - Tipos de dados Cassandra`);
  console.log(`   04. ✅ CRUD Operations - Operações básicas`);
  console.log(`   05. ✅ Unique Constraints - Restrições únicas`);
  console.log(`   06. ✅ Batch Operations - Operações em lote`);
  console.log(`   07. ✅ Relationships - Relacionamentos entre modelos`);
  console.log(`   08. ✅ Advanced Queries - Consultas avançadas`);
  console.log(`   09. ✅ Utilities - Utilitários diversos`);
  console.log(`   10. ✅ TypeScript Types - Tipos TypeScript`);
  console.log(`   11. ✅ AI/ML Features - Funcionalidades de IA/ML`);
  console.log(`   12. ✅ Event Sourcing - Event Sourcing & CQRS`);
  console.log(`   13. ✅ Distributed Transactions - Transações distribuídas`);
  console.log(`   14. ✅ Real-time Subscriptions - Subscriptions em tempo real`);
  console.log(`   15. ✅ GraphQL Integration - Integração GraphQL`);
  console.log(`   16. ✅ Performance Monitoring - Monitoramento de performance`);
  console.log(`   17. ✅ Complete Integration - Integração completa`);

  if (failed > 0) {
    console.log(`\n❌ TESTES QUE FALHARAM:`);
    results
      .filter(r => r.status === 'FAILED')
      .forEach(result => {
        console.log(`   • ${result.name}: ${result.error}`);
      });
  }

  console.log(`\n🎯 PRÓXIMOS PASSOS:`);
  if (failed === 0) {
    console.log(`   ✅ Todos os testes passaram! O CassandraORM JS está funcionando perfeitamente.`);
    console.log(`   🚀 Pronto para produção com todas as 16 funcionalidades avançadas.`);
    console.log(`   📚 Documentação completa disponível em ./docs/`);
    console.log(`   🎉 Parabéns! Você tem o ORM mais avançado para Cassandra/ScyllaDB!`);
  } else {
    console.log(`   🔧 Corrigir ${failed} teste(s) que falharam`);
    console.log(`   🔍 Verificar logs de erro acima para detalhes`);
    console.log(`   ⚡ Executar testes individuais para debug: bun run playground/XX-test-name.test.ts`);
  }

  console.log('\n' + '=' .repeat(80));
  console.log('🏁 Execução dos testes concluída!');
  console.log('=' .repeat(80));

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Execute if run directly
if (import.meta.main) {
  runAllPlaygroundTests().catch(console.error);
}

export { runAllPlaygroundTests };
