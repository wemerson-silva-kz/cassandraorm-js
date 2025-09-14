#!/usr/bin/env bun
import { 
  createClient,
  EventStore,
  BaseAggregateRoot,
  AggregateRepository,
  SagaManager,
  type DomainEvent
} from '../src/index.js';

class UserAggregate extends BaseAggregateRoot {
  private name: string = '';
  private email: string = '';
  private isActive: boolean = false;

  static create(id: string, name: string, email: string): UserAggregate {
    const user = new UserAggregate(id);
    user.addEvent('UserCreated', { name, email });
    return user;
  }

  changeName(newName: string): void {
    if (newName !== this.name) {
      this.addEvent('UserNameChanged', { 
        oldName: this.name, 
        newName 
      });
    }
  }

  activate(): void {
    if (!this.isActive) {
      this.addEvent('UserActivated', {});
    }
  }

  deactivate(): void {
    if (this.isActive) {
      this.addEvent('UserDeactivated', {});
    }
  }

  protected applyEvent(event: DomainEvent): void {
    switch (event.eventType) {
      case 'UserCreated':
        this.name = event.data.name;
        this.email = event.data.email;
        this.isActive = false;
        break;
      case 'UserNameChanged':
        this.name = event.data.newName;
        break;
      case 'UserActivated':
        this.isActive = true;
        break;
      case 'UserDeactivated':
        this.isActive = false;
        break;
    }
  }

  getName(): string { return this.name; }
  getEmail(): string { return this.email; }
  getIsActive(): boolean { return this.isActive; }
}

async function testEventSourcing() {
  console.log('🔄 Teste 12: Event Sourcing & CQRS\n');

  const client = createClient({
    clientOptions: {
      contactPoints: ['127.0.0.1'],
      localDataCenter: 'datacenter1',
      keyspace: 'test_events'
    },
    ormOptions: {
      createKeyspace: true,
      migration: 'safe'
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao Cassandra');

    // Test EventStore
    const eventStore = new EventStore(client.driver, 'test_events');
    await eventStore.initialize();
    console.log('✅ EventStore inicializado');

    // Test Aggregate Repository
    const repository = new AggregateRepository(
      eventStore, 
      (id: string) => new UserAggregate(id)
    );
    console.log('✅ AggregateRepository criado');

    // Test aggregate creation
    const userId = client.uuid();
    const user = UserAggregate.create(userId, 'John Doe', 'john@example.com');
    
    console.log('✅ Aggregate criado:', user.getId());
    console.log('   • Nome:', user.getName());
    console.log('   • Email:', user.getEmail());
    console.log('   • Ativo:', user.getIsActive());

    // Test event generation
    user.changeName('John Smith');
    user.activate();
    
    const events = user.getUncommittedEvents();
    console.log('✅ Eventos não commitados:', events.length);

    // Test saving aggregate
    await repository.save(user);
    console.log('✅ Aggregate salvo no EventStore');

    // Test loading aggregate
    const loadedUser = await repository.getById(userId, UserAggregate);
    console.log('✅ Aggregate carregado:');
    console.log('   • Nome:', loadedUser.getName());
    console.log('   • Email:', loadedUser.getEmail());
    console.log('   • Ativo:', loadedUser.getIsActive());

    // Test event history
    const eventHistory = await eventStore.getEvents(userId);
    console.log('✅ Histórico de eventos:', eventHistory.length, 'eventos');
    
    eventHistory.forEach((event, index) => {
      console.log(`   ${index + 1}. ${event.eventType} - v${event.version}`);
    });

    // Test snapshots
    await eventStore.saveSnapshot(userId, 3, {
      name: loadedUser.getName(),
      email: loadedUser.getEmail(),
      isActive: loadedUser.getIsActive()
    });
    console.log('✅ Snapshot salvo');

    const snapshot = await eventStore.getSnapshot(userId);
    console.log('✅ Snapshot carregado:', snapshot ? 'encontrado' : 'não encontrado');

    // Test Saga Manager
    const sagaManager = new SagaManager(eventStore);
    console.log('✅ SagaManager criado');

    // Define a simple saga
    const userRegistrationSaga = {
      sagaType: 'UserRegistration',
      handle: async (event: DomainEvent) => {
        if (event.eventType === 'UserCreated') {
          console.log('   📧 Enviando email de boas-vindas...');
          console.log('   🔐 Criando credenciais de acesso...');
          console.log('   📊 Registrando métricas...');
          return [
            { eventType: 'WelcomeEmailSent', data: { userId: event.aggregateId } },
            { eventType: 'CredentialsCreated', data: { userId: event.aggregateId } },
            { eventType: 'MetricsRecorded', data: { userId: event.aggregateId } }
          ];
        }
        return [];
      }
    };

    sagaManager.registerSaga(userRegistrationSaga);
    console.log('✅ Saga registrada');

    // Test saga execution
    const newUserId = client.uuid();
    const newUser = UserAggregate.create(newUserId, 'Jane Doe', 'jane@example.com');
    await repository.save(newUser);
    
    // Process saga
    const userCreatedEvent = newUser.getUncommittedEvents()[0];
    await sagaManager.handle(userCreatedEvent);
    console.log('✅ Saga executada');

    // Test projection (read model)
    const userProjection = {
      id: loadedUser.getId(),
      name: loadedUser.getName(),
      email: loadedUser.getEmail(),
      isActive: loadedUser.getIsActive(),
      version: eventHistory.length,
      lastUpdated: new Date()
    };
    console.log('✅ Projeção criada:', userProjection);

    console.log('\n📊 FUNCIONALIDADES EVENT SOURCING TESTADAS:');
    console.log('   • EventStore - Armazenamento de eventos');
    console.log('   • BaseAggregateRoot - Raiz de agregado');
    console.log('   • AggregateRepository - Repositório de agregados');
    console.log('   • Domain Events - Eventos de domínio');
    console.log('   • Event History - Histórico de eventos');
    console.log('   • Snapshots - Snapshots de estado');
    console.log('   • SagaManager - Gerenciamento de sagas');
    console.log('   • CQRS Projections - Projeções para leitura');

    console.log('\n🎉 Teste Event Sourcing: PASSOU');

  } catch (error) {
    console.error('❌ Erro no teste Event Sourcing:', error.message);
  } finally {
    await client.close();
  }
}

testEventSourcing();
