/* eslint-disable */
// @ts-nocheck
import * as vscode from 'vscode';
import { jest } from '@jest/globals';

jest.mock('vscode', () => {
  const pathModule = require('path');
  const resolvedProjectRootInFactory = pathModule.resolve(__dirname, '../..');
  return {
    Uri: {
      file: (p: string) => ({ fsPath: p, scheme: 'file' }),
      joinPath: (uri: any, ...pathSegments: string[]) => ({
        fsPath: pathModule.join(uri.fsPath, ...pathSegments),
        scheme: 'file'
      })
    },
    window: {
      createOutputChannel: () => ({
        appendLine: jest.fn(),
        show: jest.fn(),
        hide: jest.fn(),
        clear: jest.fn(),
        dispose: jest.fn()
      }),
      showInformationMessage: jest.fn(),
      showWarningMessage: jest.fn(),
      showErrorMessage: jest.fn()
    },
    workspace: {
      getConfiguration: () => ({
        get: jest.fn().mockImplementation((key) => {
          if (key === 'verboseCompression') return false;
          if (key === 'matomeru.grammars.source') return 'extension';
          return undefined;
        })
      }),
      workspaceFolders: [
        { uri: { fsPath: resolvedProjectRootInFactory, scheme: 'file' } }
      ],
      onDidChangeWorkspaceFolders: jest.fn().mockReturnValue({ dispose: jest.fn() }),
      createFileSystemWatcher: jest.fn().mockReturnValue({
        onDidCreate: jest.fn(),
        onDidChange: jest.fn(),
        onDidDelete: jest.fn(),
        dispose: jest.fn()
      })
    },
    ExtensionMode: {
      Production: 1,
      Development: 2,
      Test: 3,
    },
    l10n: {
      t: (key: string, ...args: any[]) => {
        let messagePart = '';
        if (args && args.length > 0) {
          try {
            const stringArgs = args.map(arg => {
              if (arg === null || arg === undefined) return '';
              if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
                return String(arg);
              }
              return `[${typeof arg}: ${String(arg).slice(0, 30)}]`;
            });
            messagePart = stringArgs.join(' ');
          } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            messagePart = `[Error joining args: ${errorMessage.slice(0, 50)}]`;
          }
        }
        return `${key}${messagePart ? ' ' + messagePart : ''}`;
      }
    },
    ExtensionKind: {
      UI: 1,
      Workspace: 2,
      Web: 3
    }
  };
}, { virtual: true });

jest.mock('../utils/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    clear: jest.fn(),
    dispose: jest.fn(),
  };

  return {
    Logger: {
      getInstance: jest.fn().mockReturnValue(mockLogger)
    }
  };
});

beforeAll(async () => {
  console.log('Integration test setup: ParserManager is NOT mocked. Real Tree-sitter loading is enabled.');
});

export const getExtensionContext = (): vscode.ExtensionContext => {
  const path = require('path');
  const projectRoot = path.resolve(__dirname, '../..');
  const mockedVSCode = vscode;

  return {
    extensionPath: projectRoot,
    extensionUri: mockedVSCode.Uri.file(projectRoot),
    storageUri: mockedVSCode.Uri.file(path.join(projectRoot, '.vscode-test-storage', 'workspaceStorage')),
    globalStorageUri: mockedVSCode.Uri.file(path.join(projectRoot, '.vscode-test-storage', 'globalStorage')),
    logUri: mockedVSCode.Uri.file(path.join(projectRoot, '.vscode-test-storage', 'logs')),
    secrets: {
      get: jest.fn(),
      store: jest.fn(),
      delete: jest.fn(),
      onDidChange: jest.fn(() => ({ dispose: jest.fn() }))
    } as any,
    globalState: {
      get: jest.fn(),
      update: jest.fn(),
      keys: jest.fn(() => [])
    } as any,
    workspaceState: {
      get: jest.fn(),
      update: jest.fn(),
      keys: jest.fn(() => [])
    } as any,
    subscriptions: [],
    environmentVariableCollection: {
      persistent: false,
      replace: jest.fn(),
      append: jest.fn(),
      prepend: jest.fn(),
      get: jest.fn(),
      forEach: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      [Symbol.iterator]: jest.fn(() => ({ next: () => ({ done: true, value: undefined }) }))
    } as any,
    extensionMode: mockedVSCode.ExtensionMode.Test,
    asAbsolutePath: (relativePath: string) => path.join(projectRoot, relativePath),
    languageModelAccessInformation: { ostęp: jest.fn() } as any,
    extension: {
      id: 'matomeru.test-instance',
      extensionPath: projectRoot,
      isActive: true,
      packageJSON: { name: 'matomeru-test', version: '0.0.0' },
      extensionKind: mockedVSCode.ExtensionKind.Workspace,
      exports: {},
      activate: jest.fn().mockResolvedValue({}),
      extensionUri: mockedVSCode.Uri.file(projectRoot),
    } as vscode.Extension<any>,
  } as vscode.ExtensionContext;
};
