import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('🚀 CassandraORM extension activated');

    // Generate Model Command
    const generateModel = vscode.commands.registerCommand('cassandraorm.generateModel', async () => {
        const modelName = await vscode.window.showInputBox({
            prompt: 'Enter model name',
            placeHolder: 'User'
        });

        if (modelName) {
            const terminal = vscode.window.createTerminal('CassandraORM');
            terminal.sendText(`cassandraorm generate model ${modelName}`);
            terminal.show();
        }
    });

    // Run Migration Command
    const runMigration = vscode.commands.registerCommand('cassandraorm.runMigration', () => {
        const terminal = vscode.window.createTerminal('CassandraORM');
        terminal.sendText('cassandraorm migrate');
        terminal.show();
    });

    // Open Dashboard Command
    const openDashboard = vscode.commands.registerCommand('cassandraorm.openDashboard', () => {
        vscode.env.openExternal(vscode.Uri.parse('http://localhost:3001'));
    });

    // Language Support
    const provider = vscode.languages.registerCompletionItemProvider(
        ['typescript', 'javascript'],
        {
            provideCompletionItems(document, position) {
                const completions: vscode.CompletionItem[] = [];

                // CassandraORM completions
                const clientCompletion = new vscode.CompletionItem('createClient');
                clientCompletion.insertText = new vscode.SnippetString(
                    'createClient({\n  clientOptions: {\n    contactPoints: [\'${1:127.0.0.1}\'],\n    localDataCenter: \'${2:datacenter1}\',\n    keyspace: \'${3:myapp}\'\n  }\n})'
                );
                clientCompletion.documentation = 'Create CassandraORM client';
                completions.push(clientCompletion);

                const modelCompletion = new vscode.CompletionItem('loadSchema');
                modelCompletion.insertText = new vscode.SnippetString(
                    'loadSchema(\'${1:tableName}\', {\n  fields: {\n    id: \'uuid\',\n    ${2:name}: \'text\'\n  },\n  key: [\'id\']\n})'
                );
                modelCompletion.documentation = 'Load model schema';
                completions.push(modelCompletion);

                return completions;
            }
        }
    );

    context.subscriptions.push(generateModel, runMigration, openDashboard, provider);
}

export function deactivate() {
    console.log('CassandraORM extension deactivated');
}
