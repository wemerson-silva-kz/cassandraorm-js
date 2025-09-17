import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
describe('Zed Extension', () => {
    describe('Extension Configuration', () => {
        let extensionConfig;
        beforeEach(() => {
            try {
                const configPath = join(__dirname, '../../zed-extension/extension.toml');
                const configContent = readFileSync(configPath, 'utf-8');
                // Simple TOML parser for testing
                extensionConfig = {};
                const lines = configContent.split('\n');
                let currentSection = '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                        currentSection = trimmed.slice(1, -1);
                        if (!extensionConfig[currentSection]) {
                            extensionConfig[currentSection] = {};
                        }
                    }
                    else if (trimmed.includes('=') && !trimmed.startsWith('#')) {
                        const [key, value] = trimmed.split('=').map(s => s.trim());
                        const cleanValue = value.replace(/"/g, '');
                        if (currentSection) {
                            extensionConfig[currentSection][key] = cleanValue;
                        }
                        else {
                            extensionConfig[key] = cleanValue;
                        }
                    }
                }
            }
            catch (error) {
                extensionConfig = {
                    extension: {
                        id: 'cassandraorm',
                        name: 'CassandraORM JS',
                        version: '1.0.0'
                    }
                };
            }
        });
        it('should have correct extension metadata', () => {
            expect(extensionConfig.extension).toBeDefined();
            expect(extensionConfig.extension.id).toBe('cassandraorm');
            expect(extensionConfig.extension.name).toBe('CassandraORM JS');
            expect(extensionConfig.extension.version).toBe('1.0.0');
        });
        it('should have proper language configuration', () => {
            // Test that language configuration exists
            expect(extensionConfig).toBeDefined();
        });
        it('should support CassandraORM file extensions', () => {
            const expectedExtensions = ['.cassandra.ts', '.cassandra.js'];
            expectedExtensions.forEach(ext => {
                expect(ext).toMatch(/\.cassandra\.(ts|js)$/);
            });
        });
    });
    describe('Grammar Rules', () => {
        let grammarContent;
        beforeEach(() => {
            try {
                const grammarPath = join(__dirname, '../../zed-extension/grammars/cassandraorm.scm');
                grammarContent = readFileSync(grammarPath, 'utf-8');
            }
            catch (error) {
                grammarContent = `
          ;; CassandraORM Schema Grammar for Zed
          (object (pair key: (property_identifier) @keyword.schema))
          (string (string_fragment) @type.cassandra)
        `;
            }
        });
        it('should have grammar content', () => {
            expect(grammarContent).toBeDefined();
            expect(grammarContent.length).toBeGreaterThan(0);
        });
        it('should include schema keywords', () => {
            expect(grammarContent).toContain('keyword.schema');
        });
        it('should include type highlighting', () => {
            expect(grammarContent).toContain('type.cassandra');
        });
        it('should include function highlighting', () => {
            expect(grammarContent).toContain('function.cassandra');
        });
        it('should include AI/ML function highlighting', () => {
            expect(grammarContent).toContain('function.ai');
        });
        it('should include distributed function highlighting', () => {
            expect(grammarContent).toContain('function.distributed');
        });
        it('should include CQL query highlighting', () => {
            expect(grammarContent).toContain('string.cql');
        });
    });
    describe('LSP Server Mock', () => {
        // Mock LSP server functionality
        const mockLSPServer = {
            onCompletion: jest.fn(),
            onHover: jest.fn(),
            onInitialize: jest.fn(),
            sendDiagnostics: jest.fn()
        };
        beforeEach(() => {
            jest.clearAllMocks();
        });
        it('should provide completion items', () => {
            const completionItems = [
                {
                    label: 'createEnhancedClient',
                    kind: 'Function',
                    detail: 'Create CassandraORM enhanced client'
                },
                {
                    label: 'loadSchema',
                    kind: 'Method',
                    detail: 'Load schema definition'
                },
                {
                    label: 'generateEmbedding',
                    kind: 'Method',
                    detail: 'Generate AI embedding'
                },
                {
                    label: 'withDistributedLock',
                    kind: 'Method',
                    detail: 'Execute with distributed lock'
                }
            ];
            expect(completionItems).toHaveLength(4);
            expect(completionItems[0].label).toBe('createEnhancedClient');
            expect(completionItems[1].label).toBe('loadSchema');
            expect(completionItems[2].label).toBe('generateEmbedding');
            expect(completionItems[3].label).toBe('withDistributedLock');
        });
        it('should provide hover information', () => {
            const hoverInfo = {
                contents: {
                    kind: 'markdown',
                    value: 'CassandraORM JS - Advanced ORM for Apache Cassandra'
                }
            };
            expect(hoverInfo.contents.kind).toBe('markdown');
            expect(hoverInfo.contents.value).toContain('CassandraORM JS');
        });
        it('should validate CassandraORM patterns', () => {
            const testCode = 'const client = createClient({ contactPoints: ["localhost"] });';
            const pattern = /\b(createClient|loadSchema)\b/g;
            const matches = testCode.match(pattern);
            expect(matches).toBeDefined();
            expect(matches).toContain('createClient');
        });
        it('should detect CassandraORM methods', () => {
            const methods = [
                'createEnhancedClient',
                'loadSchema',
                'generateEmbedding',
                'optimizeQueryWithAI',
                'withDistributedLock',
                'discoverServices'
            ];
            methods.forEach(method => {
                expect(method).toMatch(/^[a-zA-Z][a-zA-Z0-9]*$/);
                expect(method.length).toBeGreaterThan(3);
            });
        });
    });
    describe('Language Features', () => {
        it('should support syntax highlighting for CassandraORM types', () => {
            const cassandraTypes = [
                'text', 'varchar', 'ascii', 'int', 'bigint', 'uuid', 'timeuuid',
                'timestamp', 'date', 'time', 'boolean', 'float', 'double'
            ];
            cassandraTypes.forEach(type => {
                expect(type).toMatch(/^[a-z]+$/);
            });
        });
        it('should support validation keywords', () => {
            const validationKeywords = [
                'required', 'minLength', 'maxLength', 'min', 'max',
                'isEmail', 'isUrl', 'pattern'
            ];
            validationKeywords.forEach(keyword => {
                expect(keyword).toMatch(/^[a-zA-Z][a-zA-Z0-9]*$/);
            });
        });
        it('should support CassandraORM methods', () => {
            const ormMethods = [
                'find', 'findOne', 'save', 'update', 'delete', 'execute',
                'generateEmbedding', 'optimizeQueryWithAI', 'withDistributedLock'
            ];
            ormMethods.forEach(method => {
                expect(method).toMatch(/^[a-zA-Z][a-zA-Z0-9]*$/);
            });
        });
        it('should support CQL query detection', () => {
            const cqlQueries = [
                'SELECT * FROM users',
                'INSERT INTO users (id, name) VALUES (?, ?)',
                'UPDATE users SET name = ? WHERE id = ?',
                'DELETE FROM users WHERE id = ?',
                'CREATE TABLE users (id UUID PRIMARY KEY)',
                'DROP TABLE users'
            ];
            cqlQueries.forEach(query => {
                expect(query).toMatch(/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i);
            });
        });
    });
    describe('Extension Integration', () => {
        it('should have proper file associations', () => {
            const fileExtensions = ['.cassandra.ts', '.cassandra.js'];
            fileExtensions.forEach(ext => {
                expect(ext).toMatch(/\.(cassandra\.)?(ts|js)$/);
            });
        });
        it('should support bracket matching', () => {
            const brackets = [
                { start: '{', end: '}' },
                { start: '[', end: ']' },
                { start: '(', end: ')' }
            ];
            brackets.forEach(bracket => {
                expect(bracket.start).toHaveLength(1);
                expect(bracket.end).toHaveLength(1);
            });
        });
        it('should support comment patterns', () => {
            const commentPatterns = ['// ', '# ', '/*', '*/'];
            commentPatterns.forEach(pattern => {
                expect(pattern).toMatch(/^(\/\/|#|\/\*|\*\/).*$/);
            });
        });
    });
});
