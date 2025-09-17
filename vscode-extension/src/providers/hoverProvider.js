import * as vscode from 'vscode';
export class SchemaHoverProvider {
    provideHover(document, position, token) {
        const range = document.getWordRangeAtPosition(position);
        if (!range)
            return;
        const word = document.getText(range);
        const line = document.lineAt(position).text;
        // Field types documentation
        const typeDoc = this.getTypeDocumentation(word);
        if (typeDoc)
            return typeDoc;
        // Method documentation
        const methodDoc = this.getMethodDocumentation(word, line);
        if (methodDoc)
            return methodDoc;
        // Validation documentation
        const validationDoc = this.getValidationDocumentation(word, line);
        if (validationDoc)
            return validationDoc;
        return null;
    }
    getTypeDocumentation(word) {
        const types = {
            'text': 'UTF-8 encoded string',
            'varchar': 'UTF-8 encoded string (alias for text)',
            'ascii': 'ASCII character string',
            'int': '32-bit signed integer',
            'bigint': '64-bit signed long',
            'smallint': '16-bit signed integer',
            'tinyint': '8-bit signed integer',
            'float': '32-bit IEEE-754 floating point',
            'double': '64-bit IEEE-754 floating point',
            'decimal': 'Variable-precision decimal',
            'boolean': 'True or false',
            'uuid': 'Type 4 UUID',
            'timeuuid': 'Type 1 UUID (time-based)',
            'timestamp': 'Date and time with millisecond precision',
            'date': 'Date value (year-month-day)',
            'time': 'Time value (hour-minute-second-nanosecond)',
            'blob': 'Binary large object',
            'inet': 'IPv4 or IPv6 address',
            'counter': 'Distributed counter'
        };
        if (types[word]) {
            const markdown = new vscode.MarkdownString();
            markdown.appendCodeblock(`type: '${word}'`, 'typescript');
            markdown.appendMarkdown(`**Cassandra ${word} type**\n\n${types[word]}`);
            return new vscode.Hover(markdown);
        }
        return null;
    }
    getMethodDocumentation(word, line) {
        const methods = {
            'find': {
                description: 'Find multiple records matching the query',
                example: 'const users = await User.find({ active: true });'
            },
            'findOne': {
                description: 'Find a single record matching the query',
                example: 'const user = await User.findOne({ id: userId });'
            },
            'save': {
                description: 'Save a new record or update existing one',
                example: 'const user = await User.save({ name: "John", email: "john@example.com" });'
            },
            'update': {
                description: 'Update records matching the query',
                example: 'await User.update({ id: userId }, { name: "Jane" });'
            },
            'delete': {
                description: 'Delete records matching the query',
                example: 'await User.delete({ id: userId });'
            },
            'execute': {
                description: 'Execute raw CQL query with optional parameters',
                example: 'const result = await client.execute("SELECT * FROM users WHERE id = ?", [userId]);'
            },
            'generateEmbedding': {
                description: 'Generate AI embedding vector for semantic search',
                example: 'const embedding = await client.generateEmbedding("search text");'
            },
            'optimizeQueryWithAI': {
                description: 'Get AI-powered query optimization suggestions',
                example: 'const suggestions = await client.optimizeQueryWithAI("SELECT * FROM users");'
            },
            'withDistributedLock': {
                description: 'Execute function with distributed lock for data consistency',
                example: 'await client.withDistributedLock("resource", async () => { /* critical section */ });'
            }
        };
        if (methods[word]) {
            const method = methods[word];
            const markdown = new vscode.MarkdownString();
            markdown.appendMarkdown(`**${word}()**\n\n${method.description}\n\n`);
            markdown.appendCodeblock(method.example, 'typescript');
            return new vscode.Hover(markdown);
        }
        return null;
    }
    getValidationDocumentation(word, line) {
        const validations = {
            'required': 'Field must have a value (not null or undefined)',
            'minLength': 'Minimum string length validation',
            'maxLength': 'Maximum string length validation',
            'min': 'Minimum numeric value validation',
            'max': 'Maximum numeric value validation',
            'isEmail': 'Email format validation',
            'isUrl': 'URL format validation',
            'pattern': 'Regular expression pattern validation'
        };
        if (validations[word] && line.includes('validate')) {
            const markdown = new vscode.MarkdownString();
            markdown.appendMarkdown(`**${word} validation**\n\n${validations[word]}`);
            return new vscode.Hover(markdown);
        }
        return null;
    }
}
