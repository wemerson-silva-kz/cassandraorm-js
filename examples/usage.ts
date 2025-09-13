import { createClient } from '../src/index.js';
import { personSchema, type Person } from '../src/examples/person.js';

async function main() {
  // Criar cliente
  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'my_app',
    },
  });

  try {
    // Conectar (opcional - só para operações reais)
    // await client.connect();

    // Carregar modelo
    const PersonModel = client.loadSchema<Person>('person', personSchema);

    // Criar instância
    const person = new PersonModel({
      userID: 1,
      name: 'João',
      surname: 'Silva',
      age: 30,
    });

    console.log('Pessoa criada:', person.toJSON());

    // Salvar (requer conexão com Cassandra)
    // await person.save();

    // Buscar (requer conexão com Cassandra)
    // const found = await PersonModel.findOne({ userID: 1, age: 30 });
    // console.log('Pessoa encontrada:', found?.toJSON());

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    // await client.disconnect();
  }
}

// Executar apenas se for o arquivo principal
if (import.meta.main) {
  main();
}
