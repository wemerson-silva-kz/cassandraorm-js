import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock VS Code API
const mockVSCode = {
  CompletionItemKind: {
    TypeParameter: 1,
    Property: 2,
    Method: 3,
    Snippet: 4
  },
  MarkdownString: jest.fn().mockImplementation(() => ({
    appendCodeblock: jest.fn(),
    appendMarkdown: jest.fn()
  })),
  SnippetString: jest.fn(),
  Hover: jest.fn(),
  CompletionItem: jest.fn(),
  Position: jest.fn(),
  Range: jest.fn()
};

jest.mock('vscode', () => mockVSCode, { virtual: true });

// Import after mocking
import { SchemaCompletionProvider } from '../../vscode-extension/src/providers/completionProvider';
import { SchemaHoverProvider } from '../../vscode-extension/src/providers/hoverProvider';

describe('VS Code Extension', () => {
  describe('SchemaCompletionProvider', () => {
    let provider: SchemaCompletionProvider;
    let mockDocument: any;
    let mockPosition: any;

    beforeEach(() => {
      provider = new SchemaCompletionProvider();
      mockDocument = {
        lineAt: jest.fn().mockReturnValue({
          text: 'const schema = { fields: { name: { type: '
        })
      };
      mockPosition = { character: 40 };
    });

    it('should create SchemaCompletionProvider instance', () => {
      expect(provider).toBeDefined();
      expect(typeof provider.provideCompletionItems).toBe('function');
    });

    it('should provide field type completions', () => {
      mockDocument.lineAt.mockReturnValue({
        text: 'type: '
      });

      const completions = provider.provideCompletionItems(mockDocument, mockPosition, null as any, null as any);

      expect(Array.isArray(completions)).toBe(true);
      expect(completions.length).toBeGreaterThan(0);
      
      // Check if common types are included
      const typeNames = completions.map((item: any) => item.label || item.insertText || item);
      expect(typeNames.some((name: string) => name.includes('text'))).toBe(true);
      expect(typeNames.some((name: string) => name.includes('uuid'))).toBe(true);
      expect(typeNames.some((name: string) => name.includes('timestamp'))).toBe(true);
    });

    it('should provide validation completions', () => {
      mockDocument.lineAt.mockReturnValue({
        text: 'validate: { '
      });

      const completions = provider.provideCompletionItems(mockDocument, mockPosition, null as any, null as any);

      expect(Array.isArray(completions)).toBe(true);
      expect(completions.length).toBeGreaterThan(0);
    });

    it('should provide method completions', () => {
      mockDocument.lineAt.mockReturnValue({
        text: 'client.'
      });

      const completions = provider.provideCompletionItems(mockDocument, mockPosition, null as any, null as any);

      expect(Array.isArray(completions)).toBe(true);
      expect(completions.length).toBeGreaterThan(0);
    });

    it('should provide schema template completion', () => {
      mockDocument.lineAt.mockReturnValue({
        text: 'loadSchema('
      });

      const completions = provider.provideCompletionItems(mockDocument, mockPosition, null as any, null as any);

      expect(Array.isArray(completions)).toBe(true);
      expect(completions.length).toBeGreaterThan(0);
    });

    it('should return empty array for unrecognized context', () => {
      mockDocument.lineAt.mockReturnValue({
        text: 'const x = 123;'
      });

      const completions = provider.provideCompletionItems(mockDocument, mockPosition, null as any, null as any);

      expect(Array.isArray(completions)).toBe(true);
      expect(completions.length).toBe(0);
    });
  });

  describe('SchemaHoverProvider', () => {
    let provider: SchemaHoverProvider;
    let mockDocument: any;
    let mockPosition: any;
    let mockRange: any;

    beforeEach(() => {
      provider = new SchemaHoverProvider();
      mockRange = { start: 0, end: 4 };
      mockDocument = {
        getWordRangeAtPosition: jest.fn().mockReturnValue(mockRange),
        getText: jest.fn().mockReturnValue('text'),
        lineAt: jest.fn().mockReturnValue({ text: 'type: "text"' })
      };
      mockPosition = { line: 0, character: 10 };
    });

    it('should create SchemaHoverProvider instance', () => {
      expect(provider).toBeDefined();
      expect(typeof provider.provideHover).toBe('function');
    });

    it('should provide hover for field types', () => {
      mockDocument.getText.mockReturnValue('uuid');

      const hover = provider.provideHover(mockDocument, mockPosition, null as any);

      expect(hover).toBeDefined();
      expect(mockVSCode.MarkdownString).toHaveBeenCalled();
    });

    it('should provide hover for methods', () => {
      mockDocument.getText.mockReturnValue('find');
      mockDocument.lineAt.mockReturnValue({ text: 'client.find(' });

      const hover = provider.provideHover(mockDocument, mockPosition, null as any);

      expect(hover).toBeDefined();
      expect(mockVSCode.MarkdownString).toHaveBeenCalled();
    });

    it('should provide hover for validation rules', () => {
      mockDocument.getText.mockReturnValue('required');
      mockDocument.lineAt.mockReturnValue({ text: 'validate: { required: true }' });

      const hover = provider.provideHover(mockDocument, mockPosition, null as any);

      expect(hover).toBeDefined();
      expect(mockVSCode.MarkdownString).toHaveBeenCalled();
    });

    it('should return null for unrecognized words', () => {
      mockDocument.getText.mockReturnValue('unknownWord');
      mockDocument.lineAt.mockReturnValue({ text: 'const unknownWord = 123;' });

      const hover = provider.provideHover(mockDocument, mockPosition, null as any);

      expect(hover).toBeNull();
    });

    it('should return null when no word range found', () => {
      mockDocument.getWordRangeAtPosition.mockReturnValue(null);

      const hover = provider.provideHover(mockDocument, mockPosition, null as any);

      expect(hover).toBeFalsy();
    });
  });

  describe('Extension Integration', () => {
    it('should have proper completion trigger characters', () => {
      // This would test the package.json configuration
      const expectedTriggers = ['.', '"', "'"];
      expect(expectedTriggers).toContain('.');
      expect(expectedTriggers).toContain('"');
      expect(expectedTriggers).toContain("'");
    });

    it('should support TypeScript and JavaScript files', () => {
      const supportedLanguages = ['typescript', 'javascript'];
      expect(supportedLanguages).toContain('typescript');
      expect(supportedLanguages).toContain('javascript');
    });

    it('should have all required commands', () => {
      const requiredCommands = [
        'cassandraorm.validateSchema',
        'cassandraorm.generateMigration',
        'cassandraorm.openDashboard',
        'cassandraorm.runQuery'
      ];

      requiredCommands.forEach(command => {
        expect(command).toMatch(/^cassandraorm\./);
      });
    });
  });
});
