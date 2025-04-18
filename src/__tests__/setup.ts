/// <reference types="jest" />

import { beforeEach, jest } from '@jest/globals';
import * as vscode from 'vscode';

// VSCodeのモック定義
jest.mock('vscode', () => {
  // L10nメッセージの定義
  const l10nMessages = {
    'ja': {
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
      'msg.editorError': 'エディタエラー: {0}',
      'msg.extensionActivated': '拡張機能が有効化されました',
      'msg.extensionDeactivated': '拡張機能が無効化されました',
      'msg.commandExecuted': 'コマンド実行: {0}, 引数: {1}',
      'msg.targetUris': '処理対象のURI ({0}件):',
      'msg.targetUriInfo': '  {0}. {1} ({2})',
      'msg.excluded': '除外: {0}',
      'msg.noSelection': 'ディレクトリまたはファイルが選択されていません',
      'msg.selectedUris': '選択されたURI ({0}件):',
      'msg.selectedUriInfo': '  {0}. {1} ({2})',
      'msg.processingUris': '処理対象のURI ({0}件):',
      'msg.scanningUri': '  {0}. {1} ({2})',
      'msg.scanningDirectory': 'ディレクトリ/ファイルをスキャン ({0}/{1}): {2}',
      'msg.directoryProcessingError': 'ディレクトリ処理エラー: ',
      'msg.outputToEditor': 'エディタに出力しました',
      'msg.copiedToClipboard': 'クリップボードにコピーしました',
      'msg.sentToChatGPT': 'ChatGPTに送信しました',
      'msg.commandsRegistered': 'コマンドを登録しました',
      'msg.selectButton': '選択'
    },
    'en': {
      'msg.editorOpenSuccess': 'Opened in editor',
      'msg.clipboardCopySuccess': 'Copied to clipboard',
      'msg.chatGPTSendSuccess': 'Sent to ChatGPT',
      'msg.chatGPTDisabled': 'ChatGPT integration is disabled',
      'msg.chatGPTOnlyMac': 'ChatGPT integration is only supported on macOS',
      'msg.directoryNotFound': 'Directory not found: {0}',
      'msg.fileNotFound': 'File not found: {0}',
      'msg.fileSizeLimit': 'File size exceeds limit: {0} ({1} > {2} bytes)',
      'msg.scanError': 'Scan error: {0}',
      'msg.workspaceNotFound': 'No workspace is open',
      'msg.fileReadError': 'File read error: {0} - {1}',
      'msg.directoryScanError': 'Directory scan error: {0} - {1}',
      'msg.chatGPTError': 'ChatGPT error: {0}',
      'msg.clipboardError': 'Clipboard error: {0}',
      'msg.editorError': 'Editor error: {0}',
      'msg.extensionActivated': 'Extension activated',
      'msg.extensionDeactivated': 'Extension deactivated',
      'msg.commandExecuted': 'Command executed: {0}, args: {1}',
      'msg.targetUris': 'Target URIs ({0}):',
      'msg.targetUriInfo': '  {0}. {1} ({2})',
      'msg.excluded': 'Excluded: {0}',
      'msg.noSelection': 'No directory or file selected',
      'msg.selectedUris': 'Selected URIs ({0}):',
      'msg.selectedUriInfo': '  {0}. {1} ({2})',
      'msg.processingUris': 'Processing URIs ({0}):',
      'msg.scanningUri': '  {0}. {1} ({2})',
      'msg.scanningDirectory': 'Scanning directory/file ({0}/{1}): {2}',
      'msg.directoryProcessingError': 'Directory processing error: ',
      'msg.outputToEditor': 'Output to editor',
      'msg.copiedToClipboard': 'Copied to clipboard',
      'msg.sentToChatGPT': 'Sent to ChatGPT',
      'msg.commandsRegistered': 'Commands registered',
      'msg.selectButton': 'Select'
    }
  };

  const vscodeApi = {
    window: {
      showInformationMessage: jest.fn(),
      showErrorMessage: jest.fn(),
      showWarningMessage: jest.fn(),
      showTextDocument: jest.fn(),
      createOutputChannel: jest.fn(() => ({
        appendLine: jest.fn(),
        show: jest.fn(),
        dispose: jest.fn()
      })),
      showOpenDialog: jest.fn()
    },
    workspace: {
      workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
      openTextDocument: jest.fn(),
      getConfiguration: jest.fn(() => ({
        get: jest.fn(),
        update: jest.fn()
      })),
      fs: {
        stat: jest.fn(),
        readFile: jest.fn(),
        writeFile: jest.fn()
      },
      onDidChangeConfiguration: jest.fn()
    },
    env: {
      clipboard: {
        writeText: jest.fn()
      }
    },
    Uri: {
      file: (path: string) => ({ fsPath: path, scheme: 'file', path }),
      parse: (path: string) => ({ fsPath: path, scheme: 'file', path })
    },
    commands: {
      registerCommand: jest.fn(),
      executeCommand: jest.fn()
    },
    l10n: {
      t: (key: string, ...args: any[]) => {
        const lang = vscodeApi.l10n.bundle.language;
        const messages = l10nMessages[lang] || l10nMessages['en'];
        const message = messages[key] || key;
        return args.reduce((msg, arg, i) => msg.replace(`{${i}}`, String(arg)), message);
      },
      bundle: {
        language: 'ja'
      }
    },
    FileType: {
      Unknown: 0,
      File: 1,
      Directory: 2,
      SymbolicLink: 64
    }
  };

  return vscodeApi;
}, { virtual: true });

// テストのセットアップ
beforeEach(() => {
  // 各テストの前にモックをリセット
  jest.clearAllMocks();
});

// web-tree-sitterのモック設定
jest.mock('web-tree-sitter', () => {
  const mockParser = {
    parse: jest.fn().mockReturnValue({
      rootNode: {
        descendantsOfType: jest.fn().mockImplementation((type) => {
          if (type === 'comment') {
            return [
              { startIndex: 0, endIndex: 6 },    // "// abc"
              { startIndex: 19, endIndex: 29 }   // "/* test */"
            ];
          }
          return [];
        })
      }
    }),
    setLanguage: jest.fn()
  };

  const MockParser: any = jest.fn().mockImplementation(() => mockParser);
  
  MockParser.init = jest.fn().mockImplementation(() => Promise.resolve());
  MockParser.Language = {
    load: jest.fn().mockImplementation(() => Promise.resolve({})),
  };

  return MockParser;
}, { virtual: true });

export default vscode; 