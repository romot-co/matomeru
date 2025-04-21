import * as path from 'path';
import { collectChangedFiles, GitNotRepositoryError, GitCliNotFoundError } from '../utils/gitUtils';
import { exec } from 'child_process';

// execのモック
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

describe('gitUtils', () => {
  // テストのセットアップとクリーンアップ
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // テスト対象のワークスペースルートパス
  const workspaceRoot = '/path/to/workspace';

  describe('collectChangedFiles', () => {
    test('正常系: 変更ファイルのリストを取得', async () => {
      // モックの戻り値の設定
      const mockFiles = ['file1.ts', 'dir/file2.js', 'another/dir/file3.json'];
      const mockExec = exec as jest.MockedFunction<typeof exec>;
      mockExec.mockImplementation((_cmd, _options, callback) => {
        if (callback) {
          callback(null, { stdout: mockFiles.join('\n'), stderr: '' } as any, '');
        }
        return {} as any;
      });

      // テスト実行
      const result = await collectChangedFiles(workspaceRoot);

      // 期待する結果を確認
      expect(mockExec).toHaveBeenCalledWith(
        'git diff --name-only',
        { cwd: workspaceRoot },
        expect.any(Function)
      );
      expect(result).toHaveLength(mockFiles.length);
      
      // 各ファイルのURIが正しいことを確認
      mockFiles.forEach((file, index) => {
        const expectedPath = path.join(workspaceRoot, file);
        expect(result[index].fsPath).toBe(expectedPath);
      });
    });

    test('正常系: リビジョン範囲付きの呼び出し', async () => {
      // モックの戻り値の設定
      const mockFiles = ['changed.txt'];
      const mockExec = exec as jest.MockedFunction<typeof exec>;
      mockExec.mockImplementation((_cmd, _options, callback) => {
        if (callback) {
          callback(null, { stdout: mockFiles.join('\n'), stderr: '' } as any, '');
        }
        return {} as any;
      });

      // テスト実行
      const range = 'HEAD~1..HEAD';
      await collectChangedFiles(workspaceRoot, range);

      // 期待する結果を確認
      expect(mockExec).toHaveBeenCalledWith(
        `git diff --name-only ${range}`,
        { cwd: workspaceRoot },
        expect.any(Function)
      );
    });

    test('異常系: Gitリポジトリでない場合は例外をスロー', async () => {
      // Gitリポジトリでないエラーメッセージを模擬
      const mockExec = exec as jest.MockedFunction<typeof exec>;
      mockExec.mockImplementation((_cmd, _options, callback) => {
        if (callback) {
          callback(null, { stdout: '', stderr: 'fatal: not a git repository' } as any, '');
        }
        return {} as any;
      });

      // テスト実行と例外確認
      await expect(collectChangedFiles(workspaceRoot)).rejects.toThrow(GitNotRepositoryError);
    });

    test('異常系: Git CLIがない場合は例外をスロー', async () => {
      // Git CLIが見つからないエラーを模擬
      const mockExec = exec as jest.MockedFunction<typeof exec>;
      mockExec.mockImplementation((_cmd, _options, callback) => {
        if (callback) {
          callback(new Error("'git' is not recognized as an internal or external command"), { stdout: '', stderr: '' } as any, '');
        }
        return {} as any;
      });

      // テスト実行と例外確認
      await expect(collectChangedFiles(workspaceRoot)).rejects.toThrow(GitCliNotFoundError);
    });

    test('正常系: stderr警告があっても変更ファイルリストを返す', async () => {
      // 警告があるケース
      const mockFiles = ['file1.ts'];
      const mockExec = exec as jest.MockedFunction<typeof exec>;
      mockExec.mockImplementation((_cmd, _options, callback) => {
        if (callback) {
          callback(null, { 
            stdout: mockFiles.join('\n'), 
            stderr: 'warning: not all files checked' 
          } as any, '');
        }
        return {} as any;
      });

      // テスト実行
      const result = await collectChangedFiles(workspaceRoot);

      // 警告があっても処理されることを確認
      expect(result).toHaveLength(mockFiles.length);
    });
  });
}); 