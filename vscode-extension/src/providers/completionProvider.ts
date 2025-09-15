import * as vscode from 'vscode';

export class SchemaCompletionProvider implements vscode.CompletionItemProvider {
    
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        
        const lineText = document.lineAt(position).text;
        const linePrefix = lineText.substring(0, position.character);

        // Schema field types
        if (linePrefix.includes('type:') || linePrefix.includes('"type"')) {
            return this.getFieldTypeCompletions();
        }

        // Schema validation rules
        if (linePrefix.includes('validate:') || linePrefix.includes('"validate"')) {
            return this.getValidationCompletions();
        }

        // CassandraORM methods
        if (linePrefix.includes('client.') || linePrefix.includes('model.')) {
            return this.getMethodCompletions();
        }

        // Schema structure
        if (linePrefix.includes('loadSchema') || linePrefix.includes('fields:')) {
            return this.getSchemaCompletions();
        }

        return [];
    }

    private getFieldTypeCompletions(): vscode.CompletionItem[] {
        const types = [
            'text', 'varchar', 'ascii', 'int', 'bigint', 'smallint', 'tinyint',
            'float', 'double', 'decimal', 'boolean', 'uuid', 'timeuuid',
            'timestamp', 'date', 'time', 'blob', 'inet', 'counter',
            'set<text>', 'list<text>', 'map<text,text>', 'frozen<map<text,text>>'
        ];

        return types.map(type => {
            const item = new vscode.CompletionItem(type, vscode.CompletionItemKind.TypeParameter);
            item.detail = `Cassandra ${type} type`;
            item.insertText = `'${type}'`;
            return item;
        });
    }

    private getValidationCompletions(): vscode.CompletionItem[] {
        const validations = [
            { name: 'required', detail: 'Field is required', snippet: 'required: true' },
            { name: 'minLength', detail: 'Minimum string length', snippet: 'minLength: ${1:5}' },
            { name: 'maxLength', detail: 'Maximum string length', snippet: 'maxLength: ${1:100}' },
            { name: 'min', detail: 'Minimum numeric value', snippet: 'min: ${1:0}' },
            { name: 'max', detail: 'Maximum numeric value', snippet: 'max: ${1:100}' },
            { name: 'isEmail', detail: 'Email validation', snippet: 'isEmail: true' },
            { name: 'isUrl', detail: 'URL validation', snippet: 'isUrl: true' },
            { name: 'pattern', detail: 'Regex pattern', snippet: 'pattern: /${1:.*}/' }
        ];

        return validations.map(validation => {
            const item = new vscode.CompletionItem(validation.name, vscode.CompletionItemKind.Property);
            item.detail = validation.detail;
            item.insertText = new vscode.SnippetString(validation.snippet);
            return item;
        });
    }

    private getMethodCompletions(): vscode.CompletionItem[] {
        const methods = [
            { name: 'find', detail: 'Find records', snippet: 'find(${1:query})' },
            { name: 'findOne', detail: 'Find single record', snippet: 'findOne(${1:query})' },
            { name: 'save', detail: 'Save record', snippet: 'save(${1:data})' },
            { name: 'update', detail: 'Update records', snippet: 'update(${1:query}, ${2:data})' },
            { name: 'delete', detail: 'Delete records', snippet: 'delete(${1:query})' },
            { name: 'execute', detail: 'Execute CQL query', snippet: 'execute(${1:query}, ${2:params})' },
            { name: 'generateEmbedding', detail: 'Generate AI embedding', snippet: 'generateEmbedding(${1:text})' },
            { name: 'optimizeQueryWithAI', detail: 'AI query optimization', snippet: 'optimizeQueryWithAI(${1:query})' },
            { name: 'withDistributedLock', detail: 'Distributed locking', snippet: 'withDistributedLock(${1:resource}, ${2:callback})' }
        ];

        return methods.map(method => {
            const item = new vscode.CompletionItem(method.name, vscode.CompletionItemKind.Method);
            item.detail = method.detail;
            item.insertText = new vscode.SnippetString(method.snippet);
            return item;
        });
    }

    private getSchemaCompletions(): vscode.CompletionItem[] {
        const schemaSnippet = new vscode.SnippetString(`{
    fields: {
        \${1:id}: {
            type: '\${2:uuid}',
            \${3:validate: { required: true \\}}
        },
        \${4:name}: {
            type: '\${5:text}',
            \${6:validate: { required: true, minLength: 2 \\}}
        }
    },
    key: ['\${1:id}'],
    \${7:relations: {
        \${8:posts}: { model: '\${9:posts}', foreignKey: '\${10:user_id}', type: 'hasMany' \\}
    \\}}
}`);

        const item = new vscode.CompletionItem('Schema Template', vscode.CompletionItemKind.Snippet);
        item.detail = 'Complete CassandraORM schema template';
        item.insertText = schemaSnippet;
        item.documentation = new vscode.MarkdownString('Creates a complete schema with fields, validation, and relations');

        return [item];
    }
}
