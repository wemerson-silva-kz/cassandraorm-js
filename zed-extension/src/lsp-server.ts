import {
    createConnection,
    TextDocuments,
    Diagnostic,
    DiagnosticSeverity,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    InitializeResult,
    Hover,
    MarkupKind
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

// Create a connection for the server
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
    hasDiagnosticRelatedInformationCapability = !!(
        capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation
    );

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['.', '"', "'"]
            },
            hoverProvider: true
        }
    };

    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }

    return result;
});

connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
});

// Completion provider
connection.onCompletion(
    (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        return [
            {
                label: 'createEnhancedClient',
                kind: CompletionItemKind.Function,
                data: 1,
                detail: 'Create CassandraORM enhanced client',
                insertText: 'createEnhancedClient({\n  clientOptions: {\n    contactPoints: [\'127.0.0.1\'],\n    localDataCenter: \'datacenter1\',\n    keyspace: \'myapp\'\n  }\n})'
            },
            {
                label: 'loadSchema',
                kind: CompletionItemKind.Method,
                data: 2,
                detail: 'Load schema definition',
                insertText: 'loadSchema(\'tableName\', schema)'
            },
            {
                label: 'generateEmbedding',
                kind: CompletionItemKind.Method,
                data: 3,
                detail: 'Generate AI embedding',
                insertText: 'generateEmbedding(text)'
            },
            {
                label: 'withDistributedLock',
                kind: CompletionItemKind.Method,
                data: 4,
                detail: 'Execute with distributed lock',
                insertText: 'withDistributedLock(resource, callback)'
            }
        ];
    }
);

// Completion resolve
connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => {
        if (item.data === 1) {
            item.detail = 'CassandraORM Enhanced Client';
            item.documentation = 'Creates an enhanced CassandraORM client with AI/ML and distributed systems support';
        } else if (item.data === 2) {
            item.detail = 'Load Schema';
            item.documentation = 'Load a schema definition into CassandraORM';
        } else if (item.data === 3) {
            item.detail = 'AI Embedding';
            item.documentation = 'Generate AI embedding vector for semantic search';
        } else if (item.data === 4) {
            item.detail = 'Distributed Lock';
            item.documentation = 'Execute function with distributed locking for data consistency';
        }
        return item;
    }
);

// Hover provider
connection.onHover(
    (_textDocumentPosition: TextDocumentPositionParams): Hover => {
        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: [
                    '# CassandraORM JS',
                    'Advanced ORM for Apache Cassandra with AI/ML integration',
                    '',
                    '## Features',
                    '- **AI/ML Integration**: OpenAI embeddings and semantic search',
                    '- **Performance Optimization**: Intelligent caching and query optimization',
                    '- **Distributed Systems**: Redis caching and Consul service discovery',
                    '- **Developer Tools**: CLI, Dashboard, and IDE extensions'
                ].join('\n')
            }
        };
    }
);

// Document validation
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    const text = textDocument.getText();
    const pattern = /\b(createClient|loadSchema)\b/g;
    let m: RegExpExecArray | null;

    const diagnostics: Diagnostic[] = [];
    while ((m = pattern.exec(text))) {
        const diagnostic: Diagnostic = {
            severity: DiagnosticSeverity.Information,
            range: {
                start: textDocument.positionAt(m.index),
                end: textDocument.positionAt(m.index + m[0].length)
            },
            message: `CassandraORM method detected: ${m[0]}`,
            source: 'cassandraorm-lsp'
        };

        if (hasDiagnosticRelatedInformationCapability) {
            diagnostic.relatedInformation = [
                {
                    location: {
                        uri: textDocument.uri,
                        range: Object.assign({}, diagnostic.range)
                    },
                    message: 'CassandraORM provides advanced features like AI/ML integration'
                }
            ];
        }
        diagnostics.push(diagnostic);
    }

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
    connection.console.log('We received a file change event');
});

// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();
