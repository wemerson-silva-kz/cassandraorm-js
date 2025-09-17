import { describe, it, expect, beforeEach } from 'bun:test';
import { createClient } from "../../src/index.js";

describe('Enhanced Cassandra Client', () => {
    let client;
    
    beforeEach(async () => {
        client = createClient({
            clientOptions: {
                contactPoints: ['127.0.0.1:9042'],
                localDataCenter: 'datacenter1',
                keyspace: 'test_enhanced'
            },
            ormOptions: {
                createKeyspace: true,
                migration: 'safe'
            }
        });
    });

    describe('Client Creation', () => {
        it('should create enhanced client instance', () => {
            expect(client).toBeDefined();
            expect(typeof client.connect).toBe('function');
        });

        it('should have UUID utilities', () => {
            expect(typeof client.uuid).toBe('function');
            expect(typeof client.timeuuid).toBe('function');
        });
    });

    describe('Connection Management', () => {
        it('should connect to Cassandra', async () => {
            await client.connect();
            expect(client.isConnected()).toBe(true);
            await client.disconnect();
        });
    });

    describe('Model Operations', () => {
        it('should create and find users', async () => {
            await client.connect();
            
            const User = await client.loadSchema('enhanced_users', {
                fields: {
                    id: 'uuid',
                    name: 'text',
                    email: 'text'
                },
                key: ['id']
            });

            const user = await User.create({
                name: 'Enhanced User',
                email: 'enhanced@test.com'
            });

            expect(user).toBeDefined();
            expect(user.name).toBe('Enhanced User');

            const users = await User.find();
            expect(Array.isArray(users)).toBe(true);
            
            await client.disconnect();
        });
    });

    describe('Batch Operations', () => {
        it('should create batch instance', () => {
            const batch = client.createBatch();
            expect(batch).toBeDefined();
            expect(typeof batch.add).toBe('function');
            expect(typeof batch.execute).toBe('function');
        });
    });
});
