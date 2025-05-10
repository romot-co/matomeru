// ★★★ このファイルの先頭で ParserManager と web-tree-sitter のモックを解除 ★★★
jest.unmock('../services/parserManager');
// jest.unmock('web-tree-sitter'); // setup.integration.ts でモックされていないので解除不要

import { Parser } from 'web-tree-sitter';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { stripComments } from '../utils/compressUtils';
import { ParserManager } from '../services/parserManager';
import { getExtensionContext } from '../extension'; // stripComments が内部で呼ぶ可能性を考慮

// getExtensionContext のモック (stripComments が内部で呼ぶ場合、または ParserManager が呼ぶ場合)
if (typeof getExtensionContext === 'undefined' || jest.isMockFunction(getExtensionContext)) {
    jest.mock('../extension', () => ({
        ...jest.requireActual('../extension'),
        __esModule: true,
        getExtensionContext: jest.fn(), 
    }), {virtual: true});
}


describe('stripComments – integration with REAL WASM', () => {
  let parserManager: ParserManager; // このスコープで宣言
  const projectRoot = path.resolve(__dirname, '../../');

  const mockCtx: vscode.ExtensionContext = {
    extensionPath: projectRoot,
    extensionUri: vscode.Uri.file(projectRoot),
    storageUri: vscode.Uri.file(path.join(projectRoot, '.vscode-test', 'storage')),
    globalStorageUri: vscode.Uri.file(path.join(projectRoot, '.vscode-test', 'globalStorage')),
    logUri: vscode.Uri.file(path.join(projectRoot, '.vscode-test', 'logs')),
    secrets: {
        get: jest.fn(), store: jest.fn(), delete: jest.fn(),
        onDidChange: jest.fn(() => ({ dispose: jest.fn() }))
    } as vscode.SecretStorage,
    globalState: { get: jest.fn(), update: jest.fn(), keys: jest.fn(() => []) } as any,
    workspaceState: { get: jest.fn(), update: jest.fn(), keys: jest.fn(() => []) } as any,
    subscriptions: [],
    environmentVariableCollection: { persistent: false, replace: jest.fn(), append: jest.fn(), prepend: jest.fn(), get: jest.fn(), iterator: jest.fn(), delete: jest.fn(), clear: jest.fn(), description: '', forEach: jest.fn(), [Symbol.iterator]: jest.fn() } as any,
    extensionMode: vscode.ExtensionMode.Test,
    asAbsolutePath: (relativePath: string) => path.join(projectRoot, relativePath),
    languageModelAccessInformation: {ostęp: jest.fn() } as any,
    extension: {
        id: 'test.extension', extensionPath: projectRoot, isActive: true,
        packageJSON: { name: 'test-extension', version: '0.0.1' },
        extensionKind: vscode.ExtensionKind.Workspace, exports: {},
        activate: jest.fn().mockResolvedValue({}),
        extensionUri: vscode.Uri.file(projectRoot),
    } as vscode.Extension<any>,
    globalStoragePath: path.join(projectRoot, '.vscode-test', 'globalStorage'),
    logPath: path.join(projectRoot, '.vscode-test', 'logs'),
    storagePath: path.join(projectRoot, '.vscode-test', 'storage'),
  };

  beforeAll(async () => {
    try {
      await Parser.init({
        locateFile(scriptName: string, _scriptDirectory: string) {
          const wasmPath = path.join(projectRoot, 'node_modules/web-tree-sitter', scriptName);
          if (!fs.existsSync(wasmPath)) {
             console.error(`[REAL WASM TEST] Tree-sitter WASM runtime not found at ${wasmPath}`);
          }
          return wasmPath;
        }
      });
    } catch (error) {
      console.error('[REAL WASM TEST] Error during Parser.init:', error);
      throw error;
    }

    if (getExtensionContext && jest.isMockFunction(getExtensionContext)) {
        (getExtensionContext as jest.Mock).mockReturnValue(mockCtx);
    }
    
    // ParserManager.getInstance(mockCtx) は、ここで mockCtx を渡す
    // ParserManager の中で getExtensionContext() が呼ばれる場合は、上記のモックが機能する
    parserManager = ParserManager.getInstance(mockCtx); 
    
    const grammarsBaseDir = path.join(projectRoot, 'out/grammars'); 
    const targetGrammarsDir = path.join(grammarsBaseDir, 'wasm');
    
    if (!fs.existsSync(targetGrammarsDir)) {
        fs.mkdirSync(targetGrammarsDir, { recursive: true });
    }

    const wasmSourceDir = path.join(projectRoot, 'node_modules/@vscode/tree-sitter-wasm/wasm');
    const jsWasmFileName = 'tree-sitter-javascript.wasm';
    const jsWasmSourcePath = path.join(wasmSourceDir, jsWasmFileName);
    const jsWasmTargetPath = path.join(targetGrammarsDir, jsWasmFileName);

    if (fs.existsSync(jsWasmSourcePath)) {
        if (!fs.existsSync(jsWasmTargetPath)) {
            fs.copyFileSync(jsWasmSourcePath, jsWasmTargetPath);
        }
    } else {
        console.error(`[REAL WASM TEST] Source WASM file not found: ${jsWasmSourcePath}.`);
    }
  }, 30000);

  afterAll(() => {
    parserManager?.dispose(); // parserManager を afterAll で dispose
  });

  test('JavaScript comments are stripped using actual WASM parser', async () => {
    const code = `
      // This is a line comment
      const x = 10; /* This is a block comment */
      function hello() {
        // Another comment
        return "world"; // With a trailing comment
      }
      const url = "http://example.com"; // Not a comment
      const regex = /examplePattern/;
    `;
    const expected = `
      const x = 10; 
      function hello() {
        return "world"; 
      }
      const url = "http://example.com"; 
      const regex = /examplePattern/;
    `;
    
    const output = await stripComments(code, 'javascript', mockCtx); 
    expect(output.replace(/\s+/g, ' ').trim())
      .toBe(expected.replace(/\s+/g, ' ').trim());
  }, 10000);

  test('Unsupported language with actual ParserManager returns original code', async () => {
    const code = '# python style comment';
    const output = await stripComments(code, 'unknownlang', mockCtx); 
    expect(output).toBe(code);
  });
}); 