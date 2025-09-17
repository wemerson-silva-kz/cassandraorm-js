import * as vscode from 'vscode';
export declare class SchemaCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList>;
    private getFieldTypeCompletions;
    private getValidationCompletions;
    private getMethodCompletions;
    private getSchemaCompletions;
}
