import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import { Dirent, PathLike } from 'fs';
import * as path from 'path';
import { FileOperations } from '../fileOperations';
import { FileSizeLimitError, ScanError } from '../errors/errors';
import { ScanOptions } from '../types/fileTypes';

jest.mock('fs/promises');
jest.mock('../utils/fileUtils', () => ({
  isBinaryFile: (buf: Buffer | string) => String(buf).includes('BIN')
}));

/* ---------- FileSystemWatcher モック ---------- */
(vscode.workspace.createFileSystemWatcher as unknown) = jest.fn().mockImplementation(() => {
  const watcher = {
    onDidChange: jest.fn(() => ({ dispose: jest.fn() })),
    onDidCreate: jest.fn(() => ({ dispose: jest.fn() })),
    onDidDelete: jest.fn(() => ({ dispose: jest.fn() })),
    dispose: jest.fn()
  };
  return watcher;
});

const mockedFs = jest.mocked(fs);
const ROOT = '/ws';
const BASE_OPTS: ScanOptions = {
  maxFileSize: 1024 * 1024,
  excludePatterns: [],
  useGitignore: false,
  useVscodeignore: false
};
const d = (name: string, dir = false): Dirent =>
  ({ name, isDirectory: () => dir, isFile: () => !dir } as unknown as Dirent);

let fo: FileOperations;
beforeEach(() => {
  fo = new FileOperations(ROOT);
  mockedFs.stat.mockReset();
  mockedFs.readdir.mockReset();
  mockedFs.readFile.mockReset();
  jest.clearAllMocks();
});

/* ========== 基本機能 ========== */
describe('FileOperations: basics', () => {
  it('ディレクトリを再帰走査してファイルを収集する', async () => {
    // ① stat
    mockedFs.stat.mockImplementation(async (p: PathLike) => {
      const s = String(p);
      if (s === path.join(ROOT, 'src') || s === path.join(ROOT, 'src', 'b')) {
        return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
      }
      return { isDirectory: () => false, isFile: () => true, size: 10 } as any;
    });
    // ② readdir
    mockedFs.readdir.mockImplementation(async (p: PathLike) => {
      const s = String(p);
      if (s === path.join(ROOT, 'src'))       return [d('a.ts'), d('b', true)];
      if (s === path.join(ROOT, 'src', 'b'))  return [d('c.js')];
      return [];
    });
    // ③ readFile
    mockedFs.readFile.mockResolvedValue('DATA');

    const res = await fo.scanDirectory('src', BASE_OPTS);

    // 直下ファイル
    expect(res.files.map(f => f.relativePath)).toEqual(['src/a.ts']);
    // サブディレクトリ
    const sub = res.directories.get('b');
    expect(sub).toBeTruthy();
    expect(sub!.files.map(f => f.relativePath)).toEqual(['src/b/c.js']);
  });
});

/* ========== 除外・フィルタ系 ========== */
describe('FileOperations: filters', () => {
  /* 共通で「拡張子があればファイル」という stat モックヘルパ */
  const smartStat = async (p: PathLike, size = 10) => {
    const isDir = !/\.\w+$/.test(path.basename(String(p)));
    return { isDirectory: () => isDir, isFile: () => !isDir, size: isDir ? 0 : size } as any;
  };

  it('excludePatterns に一致するファイルを除外する', async () => {
    mockedFs.stat.mockImplementation((p) => smartStat(p));
    mockedFs.readdir.mockResolvedValue([d('skip.txt'), d('keep.txt')]);
    mockedFs.readFile.mockResolvedValue('C');

    const res = await fo.scanDirectory('.', {
      ...BASE_OPTS,
      excludePatterns: ['**/skip.txt']
    });

    expect(res.files.map(f => f.relativePath)).toEqual(['keep.txt']);
  });

  it('サイズ上限を超えるファイルをスキップする', async () => {
    mockedFs.stat.mockImplementation(async (p: PathLike) => {
      const name = path.basename(String(p));
      const tooLarge = name.startsWith('large');
      return smartStat(p, tooLarge ? 2_000_000 : 100);
    });
    mockedFs.readdir.mockResolvedValue([d('small.txt'), d('large.txt')]);
    mockedFs.readFile.mockResolvedValue('C');

    const res = await fo.scanDirectory('.', BASE_OPTS);
    expect(res.files.map(f => f.relativePath)).toEqual(['small.txt']);
  });

  it('バイナリファイルは除外される', async () => {
    mockedFs.stat.mockImplementation((p) => smartStat(p));
    mockedFs.readdir.mockResolvedValue([d('text.txt'), d('binary.dat')]);
    mockedFs.readFile.mockImplementation((async (p: PathLike) =>
      path.basename(String(p)).startsWith('binary') ? Buffer.from('BIN') : Buffer.from('TXT')
    ) as any);

    const res = await fo.scanDirectory('.', BASE_OPTS);
    expect(res.files.map(f => f.relativePath)).toEqual(['text.txt']);
  });
});

/* ========== エラーパス ========== */
describe('FileOperations: error paths', () => {
  it('サイズ超過の単一ファイルで FileSizeLimitError', async () => {
    mockedFs.stat.mockResolvedValue({ isDirectory: () => false, isFile: () => true, size: 2_000_000 } as any);
    await expect(fo.scanDirectory('big.txt', BASE_OPTS))
      .rejects.toBeInstanceOf(FileSizeLimitError);
  });

  it('fs.stat が失敗すると ScanError', async () => {
    mockedFs.stat.mockRejectedValue(new Error('fail'));
    await expect(fo.scanDirectory('x', BASE_OPTS))
      .rejects.toBeInstanceOf(ScanError);
  });
});

/* ========== detectLanguage ========== */
describe('detectLanguage', () => {
  it('拡張子マッピングが正しい', () => {
    const table: Record<string, string> = {
      'a.ts': 'typescript',
      'b.js': 'javascript',
      'c.md': 'markdown',
      'd.zzz': 'plaintext'
    };
    for (const [file, lang] of Object.entries(table)) {
      expect((fo as any).detectLanguage(file)).toBe(lang);
    }
  });
});

/* ========== dispose ========== */
describe('dispose()', () => {
  it('FileSystemWatcher が解放される', () => {
    fo.dispose();
    (vscode.workspace.createFileSystemWatcher as jest.Mock).mock.results
      .forEach(r => expect(r.value.dispose).toHaveBeenCalled());
  });
});
