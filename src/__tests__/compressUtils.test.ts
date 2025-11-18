import { describe, expect, jest, test } from '@jest/globals';
import { stripComments, minifyJsTsRuntimeEquivalent } from '../utils/compressUtils';
import * as vscode from 'vscode';
import { ParserManager } from '../services/parserManager';

type MockNode = {
  type: string;
  startIndex: number;
  endIndex: number;
  namedChildren: MockNode[];
  descendantsOfType: (type: string | string[]) => MockNode[];
};

function makeNode(type: string, start: number, end: number, children: MockNode[] = []): MockNode {
  const node: MockNode = {
    type,
    startIndex: start,
    endIndex: end,
    namedChildren: children,
    descendantsOfType: (types: string | string[]) => {
      const targets = Array.isArray(types) ? types : [types];
      const matches: MockNode[] = [];
      const visit = (n: MockNode) => {
        if (targets.includes(n.type)) {
          matches.push(n);
        }
        n.namedChildren.forEach(visit);
      };
      node.namedChildren.forEach(visit);
      return matches;
    }
  };
  return node;
}

function createJsTree(code: string) {
  const singleLineStart = code.indexOf('//');
  const singleLineEnd = code.indexOf('\n');
  const blockStart = code.indexOf('/*');
  const blockEnd = code.indexOf('*/') + 2;

  const commentNodes = [
    makeNode('comment', singleLineStart, singleLineEnd === -1 ? code.length : singleLineEnd, []),
    makeNode('comment', blockStart, blockEnd, [])
  ];

  const root = makeNode('program', 0, code.length, []);
  root.descendantsOfType = (type: string | string[]) => {
    const targets = Array.isArray(type) ? type : [type];
    if (targets.includes('comment')) {
      return commentNodes;
    }
    return [];
  };

  return { rootNode: root };
}

function createPythonTree(code: string) {
  const moduleDocText = '"""module doc"""';
  const moduleDocStart = code.indexOf(moduleDocText);
  const moduleDocEnd = moduleDocStart + moduleDocText.length;

  const funcDocText = '"""Function doc"""';
  const funcDocStart = code.indexOf(funcDocText);
  const funcDocEnd = funcDocStart + funcDocText.length;

  const moduleChildren: MockNode[] = [];
  if (moduleDocStart !== -1) {
    moduleChildren.push(
      makeNode('expression_statement', moduleDocStart, moduleDocEnd + 1, [
        makeNode('string', moduleDocStart, moduleDocEnd, [])
      ])
    );
  }

  const blockChildren: MockNode[] = [];
  if (funcDocStart !== -1) {
    blockChildren.push(
      makeNode('expression_statement', funcDocStart, funcDocEnd + 1, [
        makeNode('string', funcDocStart, funcDocEnd, [])
      ])
    );
  }

  const returnStart = code.indexOf('return');
  const returnEnd = returnStart === -1 ? code.length : returnStart + 'return'.length;
  const returnNode = makeNode('return_statement', returnStart, returnEnd, []);
  blockChildren.push(returnNode);

  const blockNode = makeNode('block', funcDocStart === -1 ? returnStart : funcDocStart, code.length, blockChildren);
  const funcNode = makeNode('function_definition', code.indexOf('def'), code.length, [blockNode]);

  moduleChildren.push(funcNode);

  const root = makeNode('module', 0, code.length, moduleChildren);
  root.descendantsOfType = (_type: string | string[]) => [];

  return { rootNode: root };
}

// ParserManagerのモック
jest.mock('../services/parserManager', () => {
  const mockInstance = {
    getParser: jest.fn()
  } as { getParser: jest.Mock };

  mockInstance.getParser.mockImplementation((langId: unknown) => {
    const languageId = langId as string;
    if (languageId === 'javascript' || languageId === 'typescript') {
        return Promise.resolve({
          parse: (code: string) => createJsTree(code)
        });
    }
    if (languageId === 'python') {
      return Promise.resolve({
        parse: (code: string) => createPythonTree(code)
      });
    }
    return Promise.resolve(null);
  });

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

  test('stripComments should remove comments and minify whitespace from JavaScript code', async () => {
    const jsCode = "// abc\nconst x = 1; /* test */";
    const result = await stripComments(jsCode, 'javascript', mockContext);
    
    // コメントが除去され、空白も最小化されることを確認
    expect(result).toBe("const x=1;");
  });

  test('stripComments should apply basic whitespace minification for unsupported languages', async () => {
    const unknownCode = "# This is a comment   \n   in an unknown language";
    const result = await stripComments(unknownCode, 'unknown', mockContext);
    
    // サポートされていない言語の場合、基本的な空白圧縮のみ適用されることを確認
    expect(result).toBe("# This is a comment in an unknown language");
    expect(result.length).toBeLessThan(unknownCode.length);
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

  test('stripComments should remove Python docstrings by default', async () => {
    const parserManager = ParserManager.getInstance(mockContext) as unknown as { getParser: jest.Mock };
    parserManager.getParser.mockImplementationOnce(() => Promise.resolve(null));

    const pythonCode = '"""module doc"""\ndef foo():\n    """Function doc"""\n    return 1\n';
    const result = await stripComments(pythonCode, 'python', mockContext);

    expect(result).toBe('def foo():\n    return 1');
  });

  test('minifyJsTsRuntimeEquivalent should shrink JavaScript code', async () => {
    const source = `
      function greet(name) {
        const words = ['Hello', name];
        console.log(words.join(' '));
      }
    `;
    const result = await minifyJsTsRuntimeEquivalent(source, 'javascript');
    expect(result.length).toBeLessThan(source.length);
    expect(result.includes('\n')).toBe(false);
  });

  test('minifyJsTsRuntimeEquivalent should return original code for unsupported languages', async () => {
    const pythonSource = 'def add(a, b):\n    return a + b\n';
    const result = await minifyJsTsRuntimeEquivalent(pythonSource, 'python');
    expect(result).toBe(pythonSource);
  });
});
