import * as vscode from 'vscode';
export declare class SchemaHoverProvider implements vscode.HoverProvider {
    provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover>;
    private getTypeDocumentation;
    private getMethodDocumentation;
    private getValidationDocumentation;
}
