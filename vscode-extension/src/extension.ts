import * as vscode from 'vscode';
import { SchemaCompletionProvider } from './providers/completionProvider';
import { SchemaHoverProvider } from './providers/hoverProvider';
import { SchemaValidator } from './validators/schemaValidator';
import { DashboardManager } from './dashboard/dashboardManager';

export function activate(context: vscode.ExtensionContext) {
    console.log('CassandraORM extension is now active!');

    // Register completion provider
    const completionProvider = new SchemaCompletionProvider();
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            ['typescript', 'javascript'],
            completionProvider,
            '.', '"', "'"
        )
    );

    // Register hover provider
    const hoverProvider = new SchemaHoverProvider();
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(
            ['typescript', 'javascript'],
            hoverProvider
        )
    );

    // Register schema validator
    const schemaValidator = new SchemaValidator();
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument((document) => {
            if (vscode.workspace.getConfiguration('cassandraorm').get('autoValidation')) {
                schemaValidator.validateDocument(document);
            }
        })
    );

    // Register commands
    const dashboardManager = new DashboardManager();

    context.subscriptions.push(
        vscode.commands.registerCommand('cassandraorm.validateSchema', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                schemaValidator.validateDocument(editor.document);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cassandraorm.generateMigration', async () => {
            const migrationName = await vscode.window.showInputBox({
                prompt: 'Enter migration name',
                placeHolder: 'add_user_table'
            });

            if (migrationName) {
                await generateMigration(migrationName);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cassandraorm.openDashboard', () => {
            dashboardManager.openDashboard();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cassandraorm.runQuery', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const selection = editor.selection;
                const query = editor.document.getText(selection);
                if (query) {
                    await runQuery(query);
                }
            }
        })
    );

    // Status bar
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(database) CassandraORM";
    statusBarItem.command = 'cassandraorm.openDashboard';
    statusBarItem.tooltip = 'Open CassandraORM Dashboard';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
}

async function generateMigration(name: string) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    const migrationContent = `
import { Migration } from 'cassandraorm-js';

export const ${name}Migration: Migration = {
    up: async (client) => {
        // Add your migration logic here
        await client.execute(\`
            CREATE TABLE IF NOT EXISTS example (
                id UUID PRIMARY KEY,
                name TEXT,
                created_at TIMESTAMP
            )
        \`);
    },
    
    down: async (client) => {
        // Add your rollback logic here
        await client.execute('DROP TABLE IF EXISTS example');
    }
};
`;

    const migrationPath = vscode.Uri.joinPath(
        workspaceFolder.uri,
        'migrations',
        `${Date.now()}_${name}.ts`
    );

    await vscode.workspace.fs.writeFile(migrationPath, Buffer.from(migrationContent));
    vscode.window.showInformationMessage(`Migration created: ${migrationPath.fsPath}`);
    
    const document = await vscode.workspace.openTextDocument(migrationPath);
    await vscode.window.showTextDocument(document);
}

async function runQuery(query: string) {
    try {
        // This would integrate with the actual CassandraORM client
        vscode.window.showInformationMessage(`Executing query: ${query.substring(0, 50)}...`);
        
        // Show results in output channel
        const outputChannel = vscode.window.createOutputChannel('CassandraORM Query Results');
        outputChannel.appendLine(`Query: ${query}`);
        outputChannel.appendLine('Results: (This would show actual query results)');
        outputChannel.show();
    } catch (error) {
        vscode.window.showErrorMessage(`Query execution failed: ${error}`);
    }
}

export function deactivate() {
    console.log('CassandraORM extension is now deactivated');
}
