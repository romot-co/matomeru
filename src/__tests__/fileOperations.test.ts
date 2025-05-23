import * as fs from 'fs/promises';
import * as fsStream from 'fs';
import * as vscode from 'vscode';
import { PathLike, ReadStream } from 'fs';
import { Readable } from 'stream';
import * as path from 'path';
import { FileOperations } from '../fileOperations';
import { FileSizeLimitError, ScanError } from '../errors/errors';
import { ScanOptions } from '../types/fileTypes';

jest.mock('fs/promises');
jest.mock('fs');
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
const mockedFsStream = jest.mocked(fsStream);
const ROOT = '/ws';
const BASE_OPTS: ScanOptions = {
  maxFileSize: 1024 * 1024,
  excludePatterns: [],
  useGitignore: false,
  useVscodeignore: false
};
const d = (name: string, dir = false): any => ({
  name: Buffer.from(name),
  isDirectory: () => dir,
  isFile: () => !dir,
  isBlockDevice: () => false,
  isCharacterDevice: () => false,
  isSymbolicLink: () => false,
  isFIFO: () => false,
  isSocket: () => false,
});

let fo: FileOperations;
beforeEach(() => {
  fo = new FileOperations(ROOT);
  mockedFs.stat.mockReset();
  mockedFs.readdir.mockReset();
  mockedFs.readFile.mockReset();
  mockedFsStream.createReadStream.mockReset();
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
    mockedFs.readdir.mockImplementation(async (p: PathLike): Promise<any[]> => {
      const s = String(p);
      if (s === path.join(ROOT, 'src'))       return [d('a.ts'), d('b', true)];
      if (s === path.join(ROOT, 'src', 'b'))  return [d('c.js')];
      return [];
    });
    // ③ createReadStream
    mockedFsStream.createReadStream.mockImplementation(() => Readable.from(['DATA']) as unknown as ReadStream);

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
    mockedFs.readdir.mockResolvedValue([d('skip.txt'), d('keep.txt')] as any[]);
    mockedFsStream.createReadStream.mockImplementation(() => Readable.from(['C']) as unknown as ReadStream);

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
    mockedFs.readdir.mockResolvedValue([d('small.txt'), d('large.txt')] as any[]);
    mockedFsStream.createReadStream.mockImplementation(() => Readable.from(['C']) as unknown as ReadStream);

    const res = await fo.scanDirectory('.', BASE_OPTS);
    expect(res.files.map(f => f.relativePath)).toEqual(['small.txt']);
  });

  it('バイナリファイルは除外される', async () => {
    mockedFs.stat.mockImplementation((p) => smartStat(p));
    mockedFs.readdir.mockResolvedValue([d('text.txt'), d('binary.dat')] as any[]);
    mockedFsStream.createReadStream.mockImplementation((p: PathLike) => {
      const base = path.basename(String(p));
      const data = base.startsWith('binary') ? 'BIN' : 'TXT';
      return Readable.from([data]) as unknown as ReadStream;
    });

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

/* ========== .gitignore / .vscodeignore 読み込み ========== */
describe('FileOperations: gitignore/vscodeignore', () => {
  const smartStat = async (p: PathLike, size = 10) => {
    const isDir = !/\.\w+$/.test(path.basename(String(p)));
    return { isDirectory: () => isDir, isFile: () => !isDir, size: isDir ? 0 : size } as any;
  };

  beforeEach(() => {
    mockedFs.stat.mockImplementation((p) => smartStat(p));
    mockedFs.readdir.mockResolvedValue([d('test.txt')] as any[]);
    mockedFsStream.createReadStream.mockImplementation(() => Readable.from(['test content']) as unknown as ReadStream);
  });

  it('useGitignore=trueの場合、.gitignoreが読み込まれる', async () => {
    // .gitignoreファイルの内容をモック
    mockedFs.readFile.mockResolvedValue('*.log\nnode_modules/\n# comment\n!important.log');

    const res = await fo.scanDirectory('.', {
      ...BASE_OPTS,
      useGitignore: true
    });

    expect(mockedFs.readFile).toHaveBeenCalledWith(
      expect.stringContaining('.gitignore'), 
      'utf-8'
    );
    expect(res.files).toHaveLength(1);
  });

  it('useVscodeignore=trueの場合、.vscodeignoreが読み込まれる', async () => {
    mockedFs.readFile.mockResolvedValue('out/**\n.vscode/\n# comment');

    const res = await fo.scanDirectory('.', {
      ...BASE_OPTS,
      useVscodeignore: true
    });

    expect(mockedFs.readFile).toHaveBeenCalledWith(
      expect.stringContaining('.vscodeignore'), 
      'utf-8'
    );
    expect(res.files).toHaveLength(1);
  });

  it('.gitignoreファイルが存在しない場合、エラーなしで続行', async () => {
    mockedFs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));

    const res = await fo.scanDirectory('.', {
      ...BASE_OPTS,
      useGitignore: true
    });

    expect(res.files).toHaveLength(1);
  });

  it('.gitignoreで除外されたファイルがスキップされる', async () => {
    mockedFs.readFile.mockResolvedValue('test.txt\n*.log');
    mockedFs.readdir.mockResolvedValue([d('test.txt'), d('app.log')] as any[]);

    const res = await fo.scanDirectory('.', {
      ...BASE_OPTS,
      useGitignore: true
    });

    // test.txtとapp.logが両方とも除外される
    expect(res.files).toHaveLength(0);
  });
});

/* ========== preload機能 ========== */
describe('FileOperations: preload', () => {
  it('preloadConfigFilesが実行されること', async () => {
    // preloadConfigFilesメソッドを直接テスト
    mockedFs.readFile.mockResolvedValue('mock content');
    
    await (fo as any).preloadConfigFiles();
    
    // .gitignoreと.vscodeignoreの読み込みが試行される
    expect(mockedFs.readFile).toHaveBeenCalledWith(
      expect.stringContaining('.gitignore'), 
      'utf-8'
    );
    expect(mockedFs.readFile).toHaveBeenCalledWith(
      expect.stringContaining('.vscodeignore'), 
      'utf-8'
    );
  });

  it('isPreloadCompletedが正しく動作すること', () => {
    // 初期状態ではfalse
    expect(fo.isPreloadCompleted()).toBe(false);
    
    // preloadConfigFilesを実行後にtrueになる（実装に依存）
    // 注：実際の実装では非同期処理の完了後にフラグが立つ
  });

  it('preloadConfigFilesでエラーが発生しても例外が投げられない', async () => {
    mockedFs.readFile.mockRejectedValue(new Error('Read error'));
    
    // エラーが発生しても例外は投げられない
    await expect((fo as any).preloadConfigFiles()).resolves.not.toThrow();
  });
});

/* ========== ファイルサイズ見積もり ========== */
describe('FileOperations: size estimation', () => {
  const smartStat = async (p: PathLike, size = 100) => {
    const isDir = !/\.\w+$/.test(path.basename(String(p)));
    return { isDirectory: () => isDir, isFile: () => !isDir, size: isDir ? 0 : size } as any;
  };

  it('estimateDirectorySizeが正しく動作すること', async () => {
    mockedFs.stat.mockImplementation((_p) => smartStat(_p, 500));
    mockedFs.readdir.mockImplementation(async (_p: PathLike, _options?: any) => {
      // withFileTypesオプションを考慮してDirentオブジェクトを返す
      return [
        { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
        { name: 'file2.js', isDirectory: () => false, isFile: () => true }
      ] as any[];
    });

    const result = await fo.estimateDirectorySize('.', BASE_OPTS);

    expect(result.totalFiles).toBe(2);
    expect(result.totalSize).toBe(1000); // 2ファイル × 500バイト
  });

  it('見積もり中にサイズ上限を超えるファイルがスキップされる', async () => {
    mockedFs.stat.mockImplementation(async (p: PathLike) => {
      const name = path.basename(String(p));
      const size = name.includes('large') ? 2_000_000 : 100;
      return { isDirectory: () => false, isFile: () => true, size } as any;
    });
    mockedFs.readdir.mockImplementation(async (_p: PathLike, _options?: any) => {
      return [
        { name: 'small.txt', isDirectory: () => false, isFile: () => true },
        { name: 'large.bin', isDirectory: () => false, isFile: () => true }
      ] as any[];
    });

    const result = await fo.estimateDirectorySize('.', BASE_OPTS);

    // 大きなファイルはカウントされない
    expect(result.totalFiles).toBe(1);
    expect(result.totalSize).toBe(100);
  });
});

/* ========== currentSelectedPath ========== */
describe('FileOperations: currentSelectedPath', () => {
  it('setCurrentSelectedPathで現在のパスが設定される', () => {
    const testPath = '/test/path';
    fo.setCurrentSelectedPath(testPath);
    
    // プライベートフィールドなので直接検証は困難だが、
    // メソッドが例外を投げないことを確認
    expect(() => fo.setCurrentSelectedPath(testPath)).not.toThrow();
  });

  it('setCurrentSelectedPathでundefinedが設定される', () => {
    fo.setCurrentSelectedPath('/test/path');
    fo.setCurrentSelectedPath(undefined);
    
    expect(() => fo.setCurrentSelectedPath(undefined)).not.toThrow();
  });
});

/* ========== ファイル処理リスト ========== */
describe('FileOperations: processFileList', () => {
  const smartStat = async (p: PathLike, size = 100) => {
    const isDir = !/\.\w+$/.test(path.basename(String(p)));
    return { isDirectory: () => isDir, isFile: () => !isDir, size: isDir ? 0 : size } as any;
  };

  it('processFileListが複数のファイルパスを処理する', async () => {
    mockedFs.stat.mockImplementation((_p) => smartStat(_p));
    mockedFs.readFile.mockResolvedValue(Buffer.from('file content'));

    const fileUris = [
      { fsPath: path.join(ROOT, 'file1.txt') } as vscode.Uri,
      { fsPath: path.join(ROOT, 'file2.js') } as vscode.Uri
    ];
    const result = await fo.processFileList(fileUris, BASE_OPTS);

    // processFileListは同一ディレクトリのファイルをまとめて1つのDirectoryInfoに含める
    expect(result).toHaveLength(1);
    expect(result[0].files).toHaveLength(2);
    expect(result[0].files[0].relativePath).toBe('file1.txt');
    expect(result[0].files[1].relativePath).toBe('file2.js');
  });

  it('processFileListで存在しないファイルはスキップされる', async () => {
    mockedFs.stat.mockImplementation(async (p: PathLike) => {
      const pathStr = String(p);
      if (pathStr.includes('missing')) {
        throw new Error('ENOENT: no such file');
      }
      return smartStat(p);
    });
    mockedFs.readFile.mockResolvedValue(Buffer.from('content'));

    const fileUris = [
      { fsPath: path.join(ROOT, 'exists.txt') } as vscode.Uri,
      { fsPath: path.join(ROOT, 'missing.txt') } as vscode.Uri
    ];
    const result = await fo.processFileList(fileUris, BASE_OPTS);

    expect(result).toHaveLength(1);
    expect(result[0].files).toHaveLength(1);
    expect(result[0].files[0].relativePath).toBe('exists.txt');
  });

  it('processFileListでサイズ超過ファイルがスキップされる', async () => {
    mockedFs.stat.mockImplementation(async (p: PathLike) => {
      const pathStr = String(p);
      const size = pathStr.includes('large') ? 2_000_000 : 100;
      return { isDirectory: () => false, isFile: () => true, size } as any;
    });
    mockedFs.readFile.mockResolvedValue(Buffer.from('content'));

    const fileUris = [
      { fsPath: path.join(ROOT, 'small.txt') } as vscode.Uri,
      { fsPath: path.join(ROOT, 'large.txt') } as vscode.Uri
    ];
    const result = await fo.processFileList(fileUris, BASE_OPTS);

    expect(result).toHaveLength(1);
    expect(result[0].files).toHaveLength(1);
    expect(result[0].files[0].relativePath).toBe('small.txt');
  });
});

/* ========== エラーハンドリング拡張 ========== */
describe('FileOperations: extended error handling', () => {
  it('readdir中にエラーが発生した場合の処理', async () => {
    mockedFs.stat.mockResolvedValue({ 
      isDirectory: () => true, 
      isFile: () => false, 
      size: 0 
    } as any);
    mockedFs.readdir.mockRejectedValue(new Error('Permission denied'));

    await expect(fo.scanDirectory('protected', BASE_OPTS))
      .rejects.toBeInstanceOf(ScanError);
  });

  it('createReadStream中にエラーが発生した場合の処理', async () => {
    mockedFs.stat.mockResolvedValue({ 
      isDirectory: () => false, 
      isFile: () => true, 
      size: 100 
    } as any);
    
    const errorStream = new Readable({
      read() {
        this.emit('error', new Error('Read stream error'));
      }
    });
    mockedFsStream.createReadStream.mockReturnValue(errorStream as unknown as ReadStream);

    // スキャンはエラーで失敗することを期待
    await expect(fo.scanDirectory('error-file.txt', BASE_OPTS))
      .rejects.toBeInstanceOf(ScanError);
  });

  it('破損したGitignoreファイルでもスキャンが継続される', async () => {
    mockedFs.stat.mockResolvedValue({ 
      isDirectory: () => true, 
      isFile: () => false, 
      size: 0 
    } as any);
    mockedFs.readdir.mockResolvedValue([]);
    
    // 破損したファイルを模擬（不正なUTF-8）
    mockedFs.readFile.mockResolvedValue(Buffer.from([0xFF, 0xFE, 0xFD]));

    // .gitignoreが破損していてもスキャンは継続される
    const result = await fo.scanDirectory('.', {
      ...BASE_OPTS,
      useGitignore: true
    });

    expect(result).toBeDefined();
  });
});

/* ========== パフォーマンステスト ========== */
describe('FileOperations: performance tests', () => {
  it('大量のファイルでもメモリ使用量が適切に管理される', async () => {
    const fileCount = 100;
    const files = Array.from({ length: fileCount }, (_, i) => d(`file${i}.txt`));
    
    mockedFs.stat.mockImplementation(async (p: PathLike) => {
      const isDir = String(p) === ROOT;
      return { isDirectory: () => isDir, isFile: () => !isDir, size: isDir ? 0 : 100 } as any;
    });
    mockedFs.readdir.mockResolvedValue(files as any[]);
    mockedFsStream.createReadStream.mockImplementation(() => 
      Readable.from(['small content']) as unknown as ReadStream
    );

    const initialMemory = process.memoryUsage().heapUsed;
    const result = await fo.scanDirectory('.', BASE_OPTS);
    const finalMemory = process.memoryUsage().heapUsed;

    expect(result.files).toHaveLength(fileCount);
    // メモリ使用量の増加が合理的な範囲内（10MB以内）
    expect(finalMemory - initialMemory).toBeLessThan(10 * 1024 * 1024);
  });

  it('深いディレクトリ構造でもスタックオーバーフローが発生しない', async () => {
    // 20階層の深いディレクトリ構造を模擬
    const maxDepth = 20;
    
    mockedFs.stat.mockImplementation(async (p: PathLike) => {
      const pathStr = String(p);
      const relativePath = path.relative(ROOT, pathStr);
      const depth = relativePath === '.' ? 0 : relativePath.split(path.sep).length;
      
      if (depth >= maxDepth) {
        return { isDirectory: () => false, isFile: () => true, size: 50 } as any;
      }
      return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
    });

    mockedFs.readdir.mockImplementation(async (p: PathLike) => {
      const pathStr = String(p);
      const relativePath = path.relative(ROOT, pathStr);
      const depth = relativePath === '.' ? 0 : relativePath.split(path.sep).length;
      
      if (depth >= maxDepth - 1) {
        return [d('deep-file.txt')];
      }
      return [d(`level${depth + 1}`, true)];
    });

    mockedFsStream.createReadStream.mockImplementation(() => 
      Readable.from(['deep content']) as unknown as ReadStream
    );

    const startTime = Date.now();
    const result = await fo.scanDirectory('.', BASE_OPTS);
    const endTime = Date.now();

    expect(result).toBeDefined();
    expect(endTime - startTime).toBeLessThan(5000); // 5秒以内
    
    // ディレクトリツリー全体から深いファイルを検索
    const getAllFiles = (dir: any): any[] => {
      let files = [...dir.files];
      for (const subDir of dir.directories.values()) {
        files = files.concat(getAllFiles(subDir));
      }
      return files;
    };
    
    const allFiles = getAllFiles(result);
    const deepFile = allFiles.find(f => f.relativePath.includes('deep-file'));
    expect(deepFile).toBeDefined();
  });
});

/* ========== エッジケース ========== */
describe('FileOperations: edge cases', () => {
  it('特殊文字を含むファイル名が正しく処理される', async () => {
    const specialFiles = [
      'ファイル名.txt',
      'file with spaces.txt', 
      'file@#$%^&*().txt',
      '.hidden-file',
      'file.with.multiple.dots.txt'
    ];

    mockedFs.stat.mockImplementation(async (p: PathLike) => {
      const pathStr = String(p);
      if (pathStr === ROOT) {
        return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
      }
      return { isDirectory: () => false, isFile: () => true, size: 100 } as any;
    });

    mockedFs.readdir.mockResolvedValue(
      specialFiles.map(name => d(name)) as any[]
    );
    
    mockedFsStream.createReadStream.mockImplementation(() => 
      Readable.from(['特殊文字コンテンツ']) as unknown as ReadStream
    );

    const result = await fo.scanDirectory('.', BASE_OPTS);

    expect(result.files).toHaveLength(specialFiles.length);
    specialFiles.forEach(fileName => {
      const file = result.files.find(f => f.relativePath === fileName);
      expect(file).toBeDefined();
      expect(file?.content).toBe('特殊文字コンテンツ');
    });
  });

  it('空のファイルが正しく処理される', async () => {
    mockedFs.stat.mockImplementation(async (p: PathLike) => {
      const pathStr = String(p);
      if (pathStr === ROOT) {
        return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
      }
      return { isDirectory: () => false, isFile: () => true, size: 0 } as any;
    });

    mockedFs.readdir.mockResolvedValue([d('empty.txt')] as any[]);
    mockedFsStream.createReadStream.mockImplementation(() => 
      Readable.from([]) as unknown as ReadStream
    );

    const result = await fo.scanDirectory('.', BASE_OPTS);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].relativePath).toBe('empty.txt');
    expect(result.files[0].content).toBe('');
    expect(result.files[0].size).toBe(0);
  });

  it('バイナリファイルが正しく除外される', async () => {
    mockedFs.stat.mockImplementation(async (p: PathLike) => {
      const pathStr = String(p);
      if (pathStr === ROOT) {
        return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
      }
      return { isDirectory: () => false, isFile: () => true, size: 1000 } as any;
    });

    mockedFs.readdir.mockResolvedValue([
      d('text.txt'),
      d('binary.exe'),
      d('image.png')
    ] as any[]);

    // バイナリファイルにはバイナリ識別子（BIN）を含める
    mockedFsStream.createReadStream.mockImplementation((filePath: PathLike) => {
      const fileName = path.basename(String(filePath));
      const content = fileName.includes('txt') ? 'text content' : 'BIN_CONTENT';
      return Readable.from([content]) as unknown as ReadStream;
    });

    const result = await fo.scanDirectory('.', BASE_OPTS);

    // テキストファイルのみが含まれる
    expect(result.files).toHaveLength(1);
    expect(result.files[0].relativePath).toBe('text.txt');
    expect(result.files[0].content).toBe('text content');
  });

  it('シンボリックリンクが適切に処理される', async () => {
    mockedFs.stat.mockImplementation(async (p: PathLike) => {
      const pathStr = String(p);
      if (pathStr === ROOT) {
        return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
      }
      return { isDirectory: () => false, isFile: () => true, size: 100 } as any;
    });

    // シンボリックリンクを含むディレクトリエントリ
    const symlinkEntry = {
      name: Buffer.from('symlink.txt'),
      isDirectory: () => false,
      isFile: () => true,
      isSymbolicLink: () => true,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isFIFO: () => false,
      isSocket: () => false
    };

    mockedFs.readdir.mockResolvedValue([symlinkEntry] as any[]);
    mockedFsStream.createReadStream.mockImplementation(() => 
      Readable.from(['symlink content']) as unknown as ReadStream
    );

    const result = await fo.scanDirectory('.', BASE_OPTS);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].relativePath).toBe('symlink.txt');
    expect(result.files[0].content).toBe('symlink content');
  });
});

/* ========== 同時実行安全性 ========== */
describe('FileOperations: concurrent safety', () => {
  it('複数の同時スキャンが安全に実行される', async () => {
    mockedFs.stat.mockImplementation(async (p: PathLike) => {
      const pathStr = String(p);
      if (pathStr.endsWith('dir1') || pathStr.endsWith('dir2')) {
        return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
      }
      return { isDirectory: () => false, isFile: () => true, size: 50 } as any;
    });

    mockedFs.readdir.mockImplementation(async (p: PathLike) => {
      const pathStr = String(p);
      if (pathStr.includes('dir1')) {
        return [d('file1.txt')] as any[];
      }
      if (pathStr.includes('dir2')) {
        return [d('file2.txt')] as any[];
      }
      return [];
    });

    mockedFsStream.createReadStream.mockImplementation((filePath: PathLike) => {
      const fileName = path.basename(String(filePath));
      return Readable.from([`content of ${fileName}`]) as unknown as ReadStream;
    });

    // 複数のスキャンを同時実行
    const scanPromises = [
      fo.scanDirectory('dir1', BASE_OPTS),
      fo.scanDirectory('dir2', BASE_OPTS)
    ];

    const results = await Promise.all(scanPromises);

    expect(results).toHaveLength(2);
    expect(results[0].files[0].relativePath).toBe('dir1/file1.txt');
    expect(results[1].files[0].relativePath).toBe('dir2/file2.txt');
  });
});

/* ========== リグレッションテスト ========== */
describe('FileOperations: regression tests', () => {
  it('相対パスの正規化が正しく動作する', async () => {
    mockedFs.stat.mockImplementation(async (p: PathLike) => {
      const pathStr = String(p);
      if (pathStr === ROOT) {
        return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
      }
      return { isDirectory: () => false, isFile: () => true, size: 100 } as any;
    });

    mockedFs.readdir.mockResolvedValue([d('test.txt')] as any[]);
    mockedFsStream.createReadStream.mockImplementation(() => 
      Readable.from(['normalized content']) as unknown as ReadStream
    );

    const result = await fo.scanDirectory('.', BASE_OPTS);

    expect(result.files).toHaveLength(1);
    // 相対パスが正規化されている（バックスラッシュや../を含まない）
    expect(result.files[0].relativePath).toBe('test.txt');
    expect(result.files[0].relativePath).not.toContain('\\');
    expect(result.files[0].relativePath).not.toContain('../');
  });

  it('除外パターンの動的更新が正しく動作する', async () => {
    mockedFs.stat.mockImplementation(async (p: PathLike) => {
      const pathStr = String(p);
      if (pathStr === ROOT) {
        return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
      }
      return { isDirectory: () => false, isFile: () => true, size: 100 } as any;
    });

    mockedFs.readdir.mockResolvedValue([
      d('keep.txt'),
      d('exclude.log')
    ] as any[]);
    
    mockedFsStream.createReadStream.mockImplementation(() => 
      Readable.from(['content']) as unknown as ReadStream
    );

    // .gitignoreの内容を動的に更新
    let gitignoreContent = '*.log';
    mockedFs.readFile.mockImplementation(async (filePath: any) => {
      if (String(filePath).includes('.gitignore')) {
        return gitignoreContent;
      }
      return 'default content';
    });

    // 初回スキャン
    const result1 = await fo.scanDirectory('.', {
      ...BASE_OPTS,
      useGitignore: true
    });

    // .gitignoreを更新
    gitignoreContent = '*.log\n*.tmp';

    // 再スキャン
    const result2 = await fo.scanDirectory('.', {
      ...BASE_OPTS, 
      useGitignore: true
    });

    // どちらの場合も除外パターンが適用される
    expect(result1.files.every(f => !f.relativePath.endsWith('.log'))).toBe(true);
    expect(result2.files.every(f => !f.relativePath.endsWith('.log'))).toBe(true);
  });
});
