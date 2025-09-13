const cassandra = require('cassandra-driver');

async function testConnection() {
  const client = new cassandra.Client({
    contactPoints: ['localhost'],
    localDataCenter: 'datacenter1'
  });

  try {
    console.log('🔄 Conectando ao Cassandra...');
    await client.connect();
    console.log('✅ Conectado com sucesso!');

    // Listar keyspaces
    const result = await client.execute('SELECT keyspace_name FROM system_schema.keyspaces');
    console.log('\n📋 Keyspaces disponíveis:');
    result.rows.forEach(row => {
      console.log(`  - ${row.keyspace_name}`);
    });

    await client.shutdown();
    console.log('\n🔌 Conexão fechada');

  } catch (error) {
    console.error('❌ Erro na conexão:', error.message);
  }
}

testConnection();
