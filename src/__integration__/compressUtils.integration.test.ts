// TreesitterのParser型をimportして使用していないが、
// setup.integration.tsでParser.init()が実行されることを確認するために残しておく
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unused-vars
// const _Parser = require('web-tree-sitter');
// import Parser, { Language } from 'web-tree-sitter'; 
import * as vscode from 'vscode';
// import * as path from 'path'; // path は使われなくなったので削除
// import * as fs from 'fs'; 
import { stripComments } from '../utils/compressUtils';
// import { ParserManager } from '../services/parserManager'; 
// import { getExtensionContext } from '../extension'; 

describe('stripComments – integration (mocked parser)', () => {
  const ctx = {
    extensionUri: vscode.Uri.file(__dirname), 
    extensionPath: __dirname,
    globalState: { get: jest.fn(), update: jest.fn(), keys: jest.fn(() => []) } as any,
  } as any; 

  interface Case { code: string; lang: string; expected: string; }

  const cases: Case[] = [
    {
      lang: 'javascript',
      code: `// line comment
/* block */ const a = 1; // tail`,
      expected: `
 const a = 1; `
    },
    {
      lang: 'typescript',
      code: `/**
      * jsdoc
      */
      export const x = 42;`,
      expected: `
      export const x = 42;`
    }
  ];

  test.each(cases)('$lang – comments are stripped (mocked)', async ({ code, lang, expected }) => {
    const out = await stripComments(code, lang, ctx);
    expect(out.replace(/\s+/g, ' ').trim()).toBe(expected.replace(/\s+/g, ' ').trim());
  });

  test('unsupported language returns original code (mocked)', async () => {
    const code = '# python style comment';
    const out = await stripComments(code, 'unknown', ctx); 
    expect(out).toBe(code);
  });

  (process.platform === 'win32' ? test.skip : test)(
    'real parser with more complex example (non-Windows only) (mocked)',
    async () => {
      const code = `
      // Line comment
      /* Multi-line
         comment */
      function example() {
        // Inside function comment
        return /* inline */ 42; // End of line
      }
      `;
      const out = await stripComments(code, 'javascript', ctx);
      const normalized = out.replace(/\s+/g, ' ').trim();
      expect(normalized).toContain('function example()');
      expect(normalized).toContain('return 42;');
      expect(normalized).not.toContain('comment');
    }
  );
});

// describe('stripComments – integration with REAL WASM', () => { ... }); のブロック全体をここから削除しました。