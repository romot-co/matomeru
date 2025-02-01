/// <reference types="jest" />

import * as vscode from 'vscode';

// VSCode APIのモック
jest.mock('vscode', () => ({
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    createTextDocument: jest.fn(),
    showTextDocument: jest.fn(),
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      clear: jest.fn(),
      dispose: jest.fn()
    }))
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn((key: string, defaultValue: any) => {
        const configMap: { [key: string]: any } = {
          'maxFileSize': 1048576,
          'excludePatterns': ['node_modules/**', '.git/**'],
          'chatGptIntegration': false,
          'directoryStructure.directoryIcon': '📁',
          'directoryStructure.fileIcon': '📄',
          'directoryStructure.indentSize': 2,
          'directoryStructure.showFileExtensions': true,
          'directoryStructure.useEmoji': true
        };
        return configMap[key] ?? defaultValue;
      })
    })),
    openTextDocument: jest.fn(),
  },
  env: {
    clipboard: {
      writeText: jest.fn(),
    },
    language: 'ja'
  },
  Uri: {
    file: (path: string) => ({ fsPath: path, scheme: 'file', path }),
  },
  commands: {
    registerCommand: jest.fn(),
  },
  // l10nのモック
  l10n: {
    t: (key: string, ...args: any[]) => {
      const messages: { [key: string]: string } = {
        'msg.editorOpenSuccess': 'エディタで開きました',
        'msg.clipboardCopySuccess': 'クリップボードにコピーしました',
        'msg.chatGPTSendSuccess': 'ChatGPTに送信しました',
        'msg.chatGPTDisabled': 'ChatGPT連携が無効です',
        'msg.chatGPTOnlyMac': 'ChatGPT連携はmacOSのみ対応しています',
        'msg.directoryNotFound': 'ディレクトリが見つかりません: {0}',
        'msg.fileNotFound': 'ファイルが見つかりません: {0}',
        'msg.fileSizeLimit': 'ファイルサイズが制限を超えています: {0} ({1} > {2}バイト)',
        'msg.scanError': 'スキャンエラー: {0}',
        'msg.workspaceNotFound': 'ワークスペースが開かれていません',
        'msg.fileReadError': 'ファイル読み込みエラー: {0} - {1}',
        'msg.directoryScanError': 'ディレクトリスキャンエラー: {0} - {1}',
        'msg.chatGPTError': 'ChatGPTエラー: {0}',
        'msg.clipboardError': 'クリップボードエラー: {0}',
        'msg.editorError': 'エディタエラー: {0}'
      };
      const message = messages[key] || key;
      return args.reduce((msg, arg, i) => msg.replace(`{${i}}`, String(arg)), message);
    },
    bundle: {
      language: 'ja'
    }
  },
}), { virtual: true });

export default vscode; 