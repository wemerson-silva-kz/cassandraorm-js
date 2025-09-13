import { createClient, uuid, timeuuid } from '../src/index.js';
import { personSchema, type Person } from '../src/examples/person.js';

async function demonstrateFeatures() {
  console.log('🚀 Express Cassandra Modern - Complete Feature Demo\n');

  // 1. Create client with full options
  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'demo_app',
      credentials: {
        username: 'cassandra',
        password: 'cassandra',
      },
    },
    ormOptions: {
      defaultReplicationStrategy: {
        class: 'SimpleStrategy',
        replication_factor: 1,
      },
      migration: 'safe',
      createKeyspace: true,
      udts: {
        address: {
          fields: {
            street: 'text',
            city: 'text',
            zip: 'text',
          },
        },
      },
      udfs: {
        avgState: {
          language: 'java',
          code: 'return Double.valueOf((state.getDouble(0) + val) / 2);',
          inputs: { state: 'tuple<double>', val: 'double' },
          returns: 'tuple<double>',
        },
      },
    },
  });

  // 2. Load schema
  const PersonModel = client.loadSchema<Person>('person', personSchema);

  console.log('✅ Client created and schema loaded');

  // 3. UUID utilities
  console.log('\n📋 UUID Utilities:');
  console.log('UUID:', uuid().toString());
  console.log('TimeUUID:', timeuuid().toString());
  console.log('TimeUUID from Date:', client.timeuuidFromDate(new Date()).toString());

  // 4. Create instances with different features
  console.log('\n👤 Creating Person instances:');

  const person1 = new PersonModel({
    userID: 1,
    uniId: uuid().toString(),
    timeId: timeuuid().toString(),
    name: 'João',
    surname: 'Silva',
    age: 30,
    points: 85.5,
    intMapDefault: new Map([['score', 100], ['level', 5]]),
    stringListDefault: ['tag1', 'tag2', 'tag3'],
    intSetDefault: new Set([1, 2, 3, 4, 5]),
    info: new Map([['department', 'Engineering'], ['role', 'Senior Developer']]),
    phones: ['+55-11-99999-9999', '+55-11-88888-8888'],
    emails: new Set(['joao@example.com', 'j.silva@company.com']),
  });

  console.log('Person 1 created:', person1.toJSON());

  // 5. Virtual fields
  console.log('\n🔄 Virtual Fields:');
  console.log('Age as string:', person1.ageString);
  person1.ageString = '35';
  console.log('Age after virtual setter:', person1.age);

  // 6. Methods from schema
  console.log('\n🛠️ Schema Methods:');
  console.log('getName():', person1.getName());
  console.log('getFullName():', person1.getFullName());
  console.log('isAdult():', person1.isAdult());

  // 7. Modification tracking
  console.log('\n📝 Modification Tracking:');
  console.log('Is modified:', person1.isModified());
  person1.name = 'João Carlos';
  console.log('After name change - Is modified:', person1.isModified());
  console.log('Name field modified:', person1.isModified('name'));
  console.log('Age field modified:', person1.isModified('age'));

  // 8. Complex data types
  console.log('\n🗂️ Complex Data Types:');
  person1.timeMap = new Map([['created', new Date()], ['updated', new Date()]]);
  person1.intList = [10, 20, 30, 40, 50];
  person1.stringSet = new Set(['javascript', 'typescript', 'cassandra', 'bun']);

  console.log('Time Map:', person1.timeMap);
  console.log('Int List:', person1.intList);
  console.log('String Set:', person1.stringSet);

  // 9. Query building (without actual execution)
  console.log('\n🔍 Query Examples (structure only):');

  // Find queries
  const findAllQuery = { userID: 1 };
  const findWithOrderQuery = { 
    userID: 1, 
    $orderby: { age: 'desc' as const },
    $limit: 10 
  };
  const findWithFiltersQuery = {
    userID: 1,
    age: { $gte: 18 },
    $filters: { active: true }
  };

  console.log('Find all query:', findAllQuery);
  console.log('Find with order query:', findWithOrderQuery);
  console.log('Find with filters query:', findWithFiltersQuery);

  // 10. Batch operations structure
  console.log('\n📦 Batch Operations:');
  const batchQueries = [
    {
      query: 'INSERT INTO person (userID, name, age, points) VALUES (?, ?, ?, ?)',
      params: [2, 'Maria', 28, 92.0],
      after_hook: () => {
        console.log('Person 2 inserted');
        return true;
      },
    },
    {
      query: 'INSERT INTO person (userID, name, age, points) VALUES (?, ?, ?, ?)',
      params: [3, 'Pedro', 35, 78.5],
      after_hook: () => {
        console.log('Person 3 inserted');
        return true;
      },
    },
  ];

  console.log('Batch queries prepared:', batchQueries.length, 'queries');

  // 11. Schema information
  console.log('\n📋 Schema Information:');
  const schema = PersonModel._properties.schema;
  console.log('Table name:', PersonModel._properties.name);
  console.log('Primary key:', schema.key);
  console.log('Indexes:', schema.indexes);
  console.log('Materialized views:', Object.keys(schema.materialized_views || {}));
  console.log('Custom indexes:', schema.custom_indexes?.length || 0);
  console.log('Graph mapping:', !!schema.graph_mapping);

  // 12. Client properties
  console.log('\n⚙️ Client Properties:');
  console.log('Has consistency levels:', !!client.consistencies);
  console.log('Has data types:', !!client.datatypes);
  console.log('Has driver access:', !!client.driver);
  console.log('Loaded models:', Object.keys(client.instance));

  console.log('\n✨ Demo completed! All features demonstrated without requiring Cassandra connection.');
  console.log('\n📝 To use with real Cassandra:');
  console.log('1. Start Cassandra/ScyllaDB');
  console.log('2. Uncomment connection and query examples');
  console.log('3. Run: await client.connect()');
  console.log('4. Execute: await person1.save()');
  console.log('5. Query: await PersonModel.find({ userID: 1 })');
}

// Execute demo
if (import.meta.main) {
  demonstrateFeatures().catch(console.error);
}
