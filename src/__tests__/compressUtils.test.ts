import { describe, expect, jest, test } from '@jest/globals';
import { stripComments } from '../utils/compressUtils';
import * as vscode from 'vscode';
import { ParserManager } from '../services/parserManager';

// ParserManagerのモック
jest.mock('../services/parserManager', () => {
  const mockInstance = {
    getParser: jest.fn().mockImplementation((langId) => {
      if (langId === 'javascript' || langId === 'typescript') {
        return Promise.resolve({
          parse: (_code: string) => {
            return {
              rootNode: {
                descendantsOfType: (type: string) => {
                  if (type === 'comment') {
                    return [
                      { startIndex: 0, endIndex: 6 },    // "// abc"
                      { startIndex: 19, endIndex: 30 }   // "/* test */"
                    ];
                  }
                  return [];
                }
              }
            };
          }
        });
      }
      return Promise.resolve(null);
    })
  };

  return {
    ParserManager: {
      getInstance: jest.fn().mockReturnValue(mockInstance)
    }
  };
});

describe('compressUtils', () => {
  const mockContext = {
    extensionUri: vscode.Uri.file('/test/extension'),
    extensionPath: '/test/extension'
  } as any;

  test('stripComments should remove comments from JavaScript code', async () => {
    const jsCode = "// abc\nconst x = 1; /* test */";
    const result = await stripComments(jsCode, 'javascript', mockContext);
    
    // コメントが除去され、余計な文字が残らないことを確認
    expect(result).toBe("\nconst x = 1;");
  });

  test('stripComments should return original code for unsupported languages', async () => {
    const unknownCode = "# This is a comment in an unknown language";
    const result = await stripComments(unknownCode, 'unknown', mockContext);
    
    // サポートされていない言語の場合、元のコードがそのまま返されることを確認
    expect(result).toBe(unknownCode);
  });
  
  test('stripComments should handle parser errors gracefully', async () => {
    // ParserManagerのgetParserメソッドをオーバーライドして、エラーをスローするようにする
    const mockGetParser = jest
      .spyOn(ParserManager.getInstance(mockContext), 'getParser')
      .mockImplementation(() => { throw new Error('Parser error'); });
    
    const code = "const x = 1; // test";
    const result = await stripComments(code, 'javascript', mockContext);
    
    // エラーが発生した場合でも、元のコードが返されることを確認
    expect(result).toBe(code);
    
    // テスト後に元の実装に戻す
    mockGetParser.mockRestore();
  });
}); 