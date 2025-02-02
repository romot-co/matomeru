import * as vscode from 'vscode';
import {
    DirectoryNotFoundError,
    FileNotFoundError,
    FileSizeLimitError,
    WorkspaceNotFoundError,
    FileReadError,
    DirectoryScanError,
    MatomeruError
} from '../errors/errors';

describe('Localization', () => {
  describe('vscode.l10n.t', () => {
    it('should return Japanese messages when language is ja', () => {
      Object.defineProperty(vscode.l10n.bundle, 'language', { value: 'ja' });
      expect(vscode.l10n.t('msg.editorOpenSuccess')).toBe('エディタで開きました');
      expect(vscode.l10n.t('msg.clipboardCopySuccess')).toBe('クリップボードにコピーしました');
      expect(vscode.l10n.t('msg.extensionActivated')).toBe('拡張機能が有効化されました');
      expect(vscode.l10n.t('msg.extensionDeactivated')).toBe('拡張機能が無効化されました');
    });

    it('should return English messages when language is not ja', () => {
      Object.defineProperty(vscode.l10n.bundle, 'language', { value: 'en' });
      expect(vscode.l10n.t('msg.editorOpenSuccess')).toBe('Opened in editor');
      expect(vscode.l10n.t('msg.clipboardCopySuccess')).toBe('Copied to clipboard');
      expect(vscode.l10n.t('msg.extensionActivated')).toBe('Extension activated');
      expect(vscode.l10n.t('msg.extensionDeactivated')).toBe('Extension deactivated');
    });

    it('should replace placeholders correctly', () => {
      Object.defineProperty(vscode.l10n.bundle, 'language', { value: 'en' });
      expect(vscode.l10n.t('msg.fileSizeLimit', 'test.txt', 200, 100))
        .toBe('File size exceeds limit: test.txt (200 > 100 bytes)');
      
      Object.defineProperty(vscode.l10n.bundle, 'language', { value: 'ja' });
      expect(vscode.l10n.t('msg.fileSizeLimit', 'test.txt', 200, 100))
        .toBe('ファイルサイズが制限を超えています: test.txt (200 > 100バイト)');
    });
  });

  describe('Error Localization', () => {
    beforeEach(() => {
      Object.defineProperty(vscode.l10n.bundle, 'language', { value: 'en' });
    });

    it('should localize DirectoryNotFoundError', () => {
      const error = new DirectoryNotFoundError('/test/dir');
      expect(error.getLocalizedMessage()).toBe('Directory not found: /test/dir');
      expect(error.getLogMessage()).toBe('FileOperationError: Directory not found: /test/dir (msg.directoryNotFound)');
    });

    it('should localize FileNotFoundError', () => {
      const error = new FileNotFoundError('/test/file.txt');
      expect(error.getLocalizedMessage()).toBe('File not found: /test/file.txt');
      expect(error.getLogMessage()).toBe('FileOperationError: File not found: /test/file.txt (msg.fileNotFound)');
    });

    it('should localize FileSizeLimitError', () => {
      const error = new FileSizeLimitError('test.txt', 200, 100);
      expect(error.getLocalizedMessage()).toBe('File size exceeds limit: test.txt (200 > 100 bytes)');
      expect(error.getLogMessage()).toBe('FileOperationError: File size exceeds limit: test.txt (200 > 100 bytes) (msg.fileSizeLimit)');
    });

    it('should localize WorkspaceNotFoundError', () => {
      const error = new WorkspaceNotFoundError();
      expect(error.getLocalizedMessage()).toBe('No workspace is open');
      expect(error.getLogMessage()).toBe('FileOperationError: No workspace is open (msg.workspaceNotFound)');
    });

    it('should localize FileReadError', () => {
      const error = new FileReadError('/test/file.txt', 'Permission denied');
      expect(error.getLocalizedMessage()).toBe('File read error: /test/file.txt - Permission denied');
      expect(error.getLogMessage()).toBe('FileOperationError: File read error: /test/file.txt - Permission denied (msg.fileReadError)');
    });

    it('should localize DirectoryScanError', () => {
      const error = new DirectoryScanError('/test/dir', 'Access denied');
      expect(error.getLocalizedMessage()).toBe('Directory scan error: /test/dir - Access denied');
      expect(error.getLogMessage()).toBe('FileOperationError: Directory scan error: /test/dir - Access denied (msg.directoryScanError)');
    });

    it('should handle MatomeruError with custom params', () => {
      const error = new MatomeruError('test.code', 'Test message', ['param1', 'param2']);
      expect(error.getLogMessage()).toBe('MatomeruError: Test message (test.code)');
    });

    it('should localize errors in Japanese', () => {
      Object.defineProperty(vscode.l10n.bundle, 'language', { value: 'ja' });
      
      const dirError = new DirectoryNotFoundError('/test/dir');
      expect(dirError.getLocalizedMessage()).toBe('ディレクトリが見つかりません: /test/dir');

      const fileError = new FileNotFoundError('/test/file.txt');
      expect(fileError.getLocalizedMessage()).toBe('ファイルが見つかりません: /test/file.txt');

      const sizeError = new FileSizeLimitError('test.txt', 200, 100);
      expect(sizeError.getLocalizedMessage()).toBe('ファイルサイズが制限を超えています: test.txt (200 > 100バイト)');

      const workspaceError = new WorkspaceNotFoundError();
      expect(workspaceError.getLocalizedMessage()).toBe('ワークスペースが開かれていません');

      const readError = new FileReadError('/test/file.txt', 'アクセス拒否');
      expect(readError.getLocalizedMessage()).toBe('ファイル読み込みエラー: /test/file.txt - アクセス拒否');

      const scanError = new DirectoryScanError('/test/dir', 'アクセス拒否');
      expect(scanError.getLocalizedMessage()).toBe('ディレクトリスキャンエラー: /test/dir - アクセス拒否');
    });
  });
}); 