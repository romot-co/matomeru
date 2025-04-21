// TreesitterのParser型をimportして使用していないが、
// setup.integration.tsでParser.init()が実行されることを確認するために残しておく
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unused-vars
// const _Parser = require('web-tree-sitter');
import { stripComments } from '../utils/compressUtils';

describe('stripComments – integration (real WASM)', () => {
  const ctx = { extensionUri: { fsPath: __dirname }, extensionPath: __dirname } as any;

  interface Case { code: string; lang: string; expected: string; }

  const cases: Case[] = [
    {
      lang: 'javascript',
      code: `// line comment
/* block */ const a = 1; // tail`,
      expected: `\n const a = 1; `
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

  test.each(cases)('$lang – comments are stripped', async ({ code, lang, expected }) => {
    const out = await stripComments(code, lang, ctx);
    expect(out.replace(/\s+/g, ' ').trim()).toBe(expected.replace(/\s+/g, ' ').trim());
  });

  test('unsupported language returns original code', async () => {
    const code = '# python style comment';
    const out = await stripComments(code, 'unknown', ctx);
    expect(out).toBe(code);
  });

  // Windowsの場合はテストをスキップ
  (process.platform === 'win32' ? test.skip : test)(
    'real parser with more complex example (non-Windows only)',
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
      // 空白の正規化をして比較
      const normalized = out.replace(/\s+/g, ' ').trim();
      expect(normalized).toContain('function example()');
      expect(normalized).toContain('return 42;');
      expect(normalized).not.toContain('comment');
    }
  );
});