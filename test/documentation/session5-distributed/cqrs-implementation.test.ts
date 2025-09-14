import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { TestHelpers } from '../utils/test-helpers';

describe('Session 5: CQRS Implementation', () => {
  let client: any;

  beforeAll(async () => {
    client = await TestHelpers.setupTestClient();
  });

  afterAll(async () => {
    await TestHelpers.cleanup();
  });

  describe('Command Side Implementation', () => {
    it('should handle commands with validation', async () => {
      interface CreateUserCommand {
        type: 'CreateUser';
        userId: string;
        email: string;
        name: string;
      }

      interface UpdateUserCommand {
        type: 'UpdateUser';
        userId: string;
        name?: string;
        email?: string;
      }

      class UserCommandHandler {
        private users = new Map();
        private events: any[] = [];

        async handle(command: CreateUserCommand | UpdateUserCommand) {
          switch (command.type) {
            case 'CreateUser':
              return await this.handleCreateUser(command);
            case 'UpdateUser':
              return await this.handleUpdateUser(command);
          }
        }

        private async handleCreateUser(command: CreateUserCommand) {
          // Validation
          if (this.users.has(command.userId)) {
            throw new Error('User already exists');
          }

          if (!command.email || !command.name) {
            throw new Error('Email and name are required');
          }

          // Create user
          const user = {
            id: command.userId,
            email: command.email,
            name: command.name,
            createdAt: new Date(),
            version: 1
          };

          this.users.set(command.userId, user);

          // Publish event
          const event = {
            type: 'UserCreated',
            aggregateId: command.userId,
            data: user,
            version: 1,
            timestamp: new Date()
          };

          this.events.push(event);
          return { success: true, userId: command.userId };
        }

        private async handleUpdateUser(command: UpdateUserCommand) {
          const user = this.users.get(command.userId);
          if (!user) {
            throw new Error('User not found');
          }

          // Update user
          const updatedUser = {
            ...user,
            ...(command.name && { name: command.name }),
            ...(command.email && { email: command.email }),
            updatedAt: new Date(),
            version: user.version + 1
          };

          this.users.set(command.userId, updatedUser);

          // Publish event
          const event = {
            type: 'UserUpdated',
            aggregateId: command.userId,
            data: updatedUser,
            version: updatedUser.version,
            timestamp: new Date()
          };

          this.events.push(event);
          return { success: true, userId: command.userId };
        }

        getEvents() {
          return this.events;
        }

        getUser(userId: string) {
          return this.users.get(userId);
        }
      }

      const commandHandler = new UserCommandHandler();

      // Test create user command
      const createResult = await commandHandler.handle({
        type: 'CreateUser',
        userId: 'user1',
        email: 'test@example.com',
        name: 'Test User'
      });

      expect(createResult.success).toBe(true);
      expect(createResult.userId).toBe('user1');

      // Test update user command
      const updateResult = await commandHandler.handle({
        type: 'UpdateUser',
        userId: 'user1',
        name: 'Updated User'
      });

      expect(updateResult.success).toBe(true);

      // Verify events were published
      const events = commandHandler.getEvents();
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('UserCreated');
      expect(events[1].type).toBe('UserUpdated');

      // Verify user state
      const user = commandHandler.getUser('user1');
      expect(user.name).toBe('Updated User');
      expect(user.version).toBe(2);
    });
  });

  describe('Query Side Implementation', () => {
    it('should handle queries with read models', async () => {
      interface UserReadModel {
        id: string;
        email: string;
        name: string;
        createdAt: Date;
        updatedAt?: Date;
        status: string;
      }

      class UserQueryHandler {
        private readModels = new Map<string, UserReadModel>();

        // Simulate projection from events
        projectEvent(event: any) {
          switch (event.type) {
            case 'UserCreated':
              this.readModels.set(event.aggregateId, {
                id: event.aggregateId,
                email: event.data.email,
                name: event.data.name,
                createdAt: event.data.createdAt,
                status: 'active'
              });
              break;

            case 'UserUpdated':
              const existing = this.readModels.get(event.aggregateId);
              if (existing) {
                this.readModels.set(event.aggregateId, {
                  ...existing,
                  name: event.data.name || existing.name,
                  email: event.data.email || existing.email,
                  updatedAt: event.data.updatedAt
                });
              }
              break;
          }
        }

        async getUserById(id: string): Promise<UserReadModel | null> {
          return this.readModels.get(id) || null;
        }

        async getUsersByStatus(status: string): Promise<UserReadModel[]> {
          return Array.from(this.readModels.values())
            .filter(user => user.status === status);
        }

        async searchUsers(query: string): Promise<UserReadModel[]> {
          const searchTerm = query.toLowerCase();
          return Array.from(this.readModels.values())
            .filter(user => 
              user.name.toLowerCase().includes(searchTerm) ||
              user.email.toLowerCase().includes(searchTerm)
            );
        }

        async getUserStatistics() {
          const users = Array.from(this.readModels.values());
          return {
            total: users.length,
            byStatus: users.reduce((acc, user) => {
              acc[user.status] = (acc[user.status] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          };
        }

        getAllUsers() {
          return Array.from(this.readModels.values());
        }
      }

      const queryHandler = new UserQueryHandler();

      // Simulate events from command side
      const events = [
        {
          type: 'UserCreated',
          aggregateId: 'user1',
          data: {
            email: 'user1@example.com',
            name: 'User One',
            createdAt: new Date()
          }
        },
        {
          type: 'UserCreated',
          aggregateId: 'user2',
          data: {
            email: 'user2@example.com',
            name: 'User Two',
            createdAt: new Date()
          }
        },
        {
          type: 'UserUpdated',
          aggregateId: 'user1',
          data: {
            name: 'Updated User One',
            updatedAt: new Date()
          }
        }
      ];

      // Project events to read models
      events.forEach(event => queryHandler.projectEvent(event));

      // Test queries
      const user1 = await queryHandler.getUserById('user1');
      expect(user1?.name).toBe('Updated User One');
      expect(user1?.updatedAt).toBeDefined();

      const activeUsers = await queryHandler.getUsersByStatus('active');
      expect(activeUsers).toHaveLength(2);

      const searchResults = await queryHandler.searchUsers('user one');
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].name).toBe('Updated User One');

      const stats = await queryHandler.getUserStatistics();
      expect(stats.total).toBe(2);
      expect(stats.byStatus.active).toBe(2);
    });
  });

  describe('Event Projections', () => {
    it('should handle event projections with multiple read models', async () => {
      class ProjectionHandler {
        private userReadModel = new Map();
        private userStatsReadModel = new Map();
        private eventLog: any[] = [];

        async handleEvent(event: any) {
          this.eventLog.push(event);

          switch (event.type) {
            case 'UserCreated':
              await this.handleUserCreated(event);
              break;
            case 'UserUpdated':
              await this.handleUserUpdated(event);
              break;
            case 'UserDeactivated':
              await this.handleUserDeactivated(event);
              break;
          }
        }

        private async handleUserCreated(event: any) {
          // Update user read model
          this.userReadModel.set(event.aggregateId, {
            id: event.aggregateId,
            email: event.data.email,
            name: event.data.name,
            status: 'active',
            createdAt: event.timestamp,
            version: event.version
          });

          // Update stats read model
          const currentStats = this.userStatsReadModel.get('global') || {
            totalUsers: 0,
            activeUsers: 0,
            inactiveUsers: 0
          };

          this.userStatsReadModel.set('global', {
            ...currentStats,
            totalUsers: currentStats.totalUsers + 1,
            activeUsers: currentStats.activeUsers + 1
          });
        }

        private async handleUserUpdated(event: any) {
          const user = this.userReadModel.get(event.aggregateId);
          if (user) {
            this.userReadModel.set(event.aggregateId, {
              ...user,
              ...event.data,
              updatedAt: event.timestamp,
              version: event.version
            });
          }
        }

        private async handleUserDeactivated(event: any) {
          const user = this.userReadModel.get(event.aggregateId);
          if (user) {
            this.userReadModel.set(event.aggregateId, {
              ...user,
              status: 'inactive',
              deactivatedAt: event.timestamp,
              version: event.version
            });

            // Update stats
            const currentStats = this.userStatsReadModel.get('global');
            if (currentStats) {
              this.userStatsReadModel.set('global', {
                ...currentStats,
                activeUsers: currentStats.activeUsers - 1,
                inactiveUsers: currentStats.inactiveUsers + 1
              });
            }
          }
        }

        getUserReadModel() {
          return this.userReadModel;
        }

        getStatsReadModel() {
          return this.userStatsReadModel;
        }

        getEventLog() {
          return this.eventLog;
        }
      }

      const projectionHandler = new ProjectionHandler();

      // Process events
      const events = [
        {
          type: 'UserCreated',
          aggregateId: 'user1',
          data: { email: 'user1@test.com', name: 'User 1' },
          version: 1,
          timestamp: new Date()
        },
        {
          type: 'UserCreated',
          aggregateId: 'user2',
          data: { email: 'user2@test.com', name: 'User 2' },
          version: 1,
          timestamp: new Date()
        },
        {
          type: 'UserDeactivated',
          aggregateId: 'user1',
          data: { reason: 'User requested' },
          version: 2,
          timestamp: new Date()
        }
      ];

      for (const event of events) {
        await projectionHandler.handleEvent(event);
      }

      // Verify user read model
      const userReadModel = projectionHandler.getUserReadModel();
      expect(userReadModel.size).toBe(2);
      
      const user1 = userReadModel.get('user1');
      expect(user1.status).toBe('inactive');
      expect(user1.deactivatedAt).toBeDefined();

      const user2 = userReadModel.get('user2');
      expect(user2.status).toBe('active');

      // Verify stats read model
      const statsReadModel = projectionHandler.getStatsReadModel();
      const globalStats = statsReadModel.get('global');
      expect(globalStats.totalUsers).toBe(2);
      expect(globalStats.activeUsers).toBe(1);
      expect(globalStats.inactiveUsers).toBe(1);

      // Verify event log
      const eventLog = projectionHandler.getEventLog();
      expect(eventLog).toHaveLength(3);
    });
  });

  describe('Command and Query Bus', () => {
    it('should implement command and query buses', async () => {
      class CommandBus {
        private handlers = new Map();
        private middleware: any[] = [];

        registerHandler(commandType: string, handler: any) {
          this.handlers.set(commandType, handler);
        }

        addMiddleware(middleware: any) {
          this.middleware.push(middleware);
        }

        async execute(command: any) {
          let context = { command, timestamp: new Date() };

          // Execute middleware
          for (const middleware of this.middleware) {
            context = await middleware.beforeCommand(context);
          }

          // Execute command
          const handler = this.handlers.get(command.type);
          if (!handler) {
            throw new Error(`No handler registered for command type: ${command.type}`);
          }

          const result = await handler.handle(context.command);

          // Execute middleware after
          for (const middleware of this.middleware.reverse()) {
            if (middleware.afterCommand) {
              context = await middleware.afterCommand({ ...context, result });
            }
          }

          return result;
        }
      }

      class QueryBus {
        private handlers = new Map();
        private cache = new Map();

        registerHandler(queryType: string, handler: any) {
          this.handlers.set(queryType, handler);
        }

        async execute(query: any) {
          // Check cache first
          const cacheKey = `${query.type}:${JSON.stringify(query.params || {})}`;
          if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
          }

          const handler = this.handlers.get(query.type);
          if (!handler) {
            throw new Error(`No handler registered for query type: ${query.type}`);
          }

          const result = await handler.handle(query);

          // Cache result
          this.cache.set(cacheKey, result);

          return result;
        }
      }

      // Setup buses
      const commandBus = new CommandBus();
      const queryBus = new QueryBus();

      // Mock handlers
      const mockCommandHandler = {
        handle: async (command: any) => {
          return { success: true, commandType: command.type };
        }
      };

      const mockQueryHandler = {
        handle: async (query: any) => {
          return { data: `Result for ${query.type}`, queryType: query.type };
        }
      };

      // Register handlers
      commandBus.registerHandler('TestCommand', mockCommandHandler);
      queryBus.registerHandler('TestQuery', mockQueryHandler);

      // Add middleware
      let middlewareExecuted = false;
      commandBus.addMiddleware({
        beforeCommand: async (context: any) => {
          middlewareExecuted = true;
          return context;
        }
      });

      // Test command execution
      const commandResult = await commandBus.execute({
        type: 'TestCommand',
        data: 'test'
      });

      expect(commandResult.success).toBe(true);
      expect(middlewareExecuted).toBe(true);

      // Test query execution
      const queryResult = await queryBus.execute({
        type: 'TestQuery',
        params: { id: '123' }
      });

      expect(queryResult.data).toBe('Result for TestQuery');

      // Test query caching
      const cachedResult = await queryBus.execute({
        type: 'TestQuery',
        params: { id: '123' }
      });

      expect(cachedResult).toEqual(queryResult);
    });
  });
});
