import * as fs from 'fs/promises';
import { FileOperations } from '../fileOperations';
import { ScanOptions } from '../types/fileTypes';
import { FileSizeLimitError, ScanError } from '../errors/errors';
import { PathLike, Dirent } from 'fs';

jest.mock('fs/promises');
const mockedFs = jest.mocked(fs);

describe('FileOperations', () => {
    const workspaceRoot = '/test/workspace';
    const defaultOptions: ScanOptions = {
        maxFileSize: 1048576,
        excludePatterns: ['node_modules/**', '.git/**']
    };

    let fileOps: FileOperations;

    beforeEach(() => {
        fileOps = new FileOperations(workspaceRoot);
        jest.clearAllMocks();
    });

    describe('scanDirectory - basic functionality', () => {
        it('正しくディレクトリをスキャンする', async () => {
            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => {
                const pathStr = String(_filePath);
                if (pathStr.endsWith('/test') || pathStr.endsWith('/dir1')) {
                    return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
                }
                return { isDirectory: () => false, isFile: () => true, size: 100 } as any;
            });

            mockedFs.readdir.mockImplementation(async (_path: PathLike, _options?: any) => {
                const pathStr = _path.toString();
                if (pathStr === `${workspaceRoot}/test`) {
                    return [
                        { name: 'file1.ts', isDirectory: () => false, isFile: () => true },
                        { name: 'dir1', isDirectory: () => true, isFile: () => false },
                    ] as unknown as Dirent[];
                } else if (pathStr === `${workspaceRoot}/test/dir1`) {
                    return [
                        { name: 'subfile.ts', isDirectory: () => false, isFile: () => true }
                    ] as unknown as Dirent[];
                }
                return [] as Dirent[];
            });

            mockedFs.readFile.mockResolvedValue('file content');

            const result = await fileOps.scanDirectory('test', defaultOptions);

            expect(result.files).toHaveLength(1);
            expect(result.directories.size).toBe(1);
            expect(result.files[0].language).toBe('typescript');
            expect(mockedFs.readdir).toHaveBeenCalledTimes(2);
        });

        it('空のディレクトリを正しく処理する', async () => {
            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => ({
                isDirectory: () => true,
                isFile: () => false,
                size: 0
            } as any));

            mockedFs.readdir.mockImplementation(async (_path: PathLike, _options?: any) => {
                return [] as Dirent[];
            });

            const result = await fileOps.scanDirectory('empty', defaultOptions);

            expect(result.files).toHaveLength(0);
            expect(result.directories.size).toBe(0);
            expect(mockedFs.readdir).toHaveBeenCalledTimes(1);
        });
    });

    describe('scanDirectory - exclusion patterns', () => {
        it('除外パターンに一致するファイル/ディレクトリをスキップする', async () => {
            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => ({
                isDirectory: () => _filePath.toString().endsWith('/test'),
                isFile: () => !_filePath.toString().endsWith('/test'),
                size: 0
            } as any));

            mockedFs.readdir.mockImplementation(async (_path: PathLike, _options?: any) => {
                const pathStr = _path.toString();
                if (pathStr === `${workspaceRoot}/test`) {
                    return [
                        { name: 'node_modules', isDirectory: () => true, isFile: () => false },
                        { name: 'src', isDirectory: () => true, isFile: () => false },
                    ] as unknown as Dirent[];
                }
                return [] as Dirent[];
            });

            const result = await fileOps.scanDirectory('test', {
                ...defaultOptions,
                excludePatterns: ['node_modules']
            });

            expect(result.directories.size).toBe(1);
            expect(result.directories.has('src')).toBe(true);
            expect(result.directories.has('node_modules')).toBe(false);
        });

        it('複雑な除外パターンを正しく処理する', async () => {
            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => ({
                isDirectory: () => _filePath.toString().endsWith('/test'),
                isFile: () => !_filePath.toString().endsWith('/test'),
                size: 0
            } as any));

            mockedFs.readdir.mockImplementation(async (_path: PathLike, _options?: any) => {
                const pathStr = _path.toString();
                if (pathStr === `${workspaceRoot}/test`) {
                    return [
                        { name: '.git', isDirectory: () => true, isFile: () => false },
                        { name: 'dist', isDirectory: () => true, isFile: () => false },
                        { name: '.DS_Store', isFile: () => true, isDirectory: () => false },
                    ] as unknown as Dirent[];
                }
                return [] as Dirent[];
            });

            const result = await fileOps.scanDirectory('test', {
                ...defaultOptions,
                excludePatterns: ['.git', 'dist', '.DS_Store']
            });

            expect(result.directories.size).toBe(0);
            expect(result.files).toHaveLength(0);
        });
    });

    describe('scanDirectory - file size limits', () => {
        it('最大ファイルサイズを超えるファイルをスキップする', async () => {
            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => ({
                isDirectory: () => _filePath.toString().endsWith('/test'),
                isFile: () => !_filePath.toString().endsWith('/test'),
                size: String(_filePath).includes('large') ? 2000000 : 1000
            } as any));

            mockedFs.readdir.mockImplementation(async (_path: PathLike, _options?: any) => {
                const pathStr = _path.toString();
                if (pathStr === `${workspaceRoot}/test`) {
                    return [
                        { name: 'small.ts', isDirectory: () => false, isFile: () => true },
                        { name: 'large.ts', isDirectory: () => false, isFile: () => true },
                    ] as unknown as Dirent[];
                }
                return [] as Dirent[];
            });

            mockedFs.readFile.mockResolvedValue('file content');

            const result = await fileOps.scanDirectory('test', defaultOptions);

            expect(result.files).toHaveLength(1);
            expect(result.files[0].relativePath).toContain('small.ts');
        });

        it('境界値のファイルサイズを正しく処理する', async () => {
            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => ({
                isDirectory: () => _filePath.toString().endsWith('/test'),
                isFile: () => !_filePath.toString().endsWith('/test'),
                size: String(_filePath).includes('over') ? 1048577 : 1048576
            } as any));

            mockedFs.readdir.mockImplementation(async (_path: PathLike, _options?: any) => {
                const pathStr = _path.toString();
                if (pathStr === `${workspaceRoot}/test`) {
                    return [
                        { name: 'exact.ts', isDirectory: () => false, isFile: () => true },
                        { name: 'over.ts', isDirectory: () => false, isFile: () => true },
                    ] as unknown as Dirent[];
                }
                return [] as Dirent[];
            });

            mockedFs.readFile.mockResolvedValue('file content');

            const result = await fileOps.scanDirectory('test', defaultOptions);

            expect(result.files).toHaveLength(1);
            expect(result.files[0].relativePath).toContain('exact.ts');
        });
    });

    describe('scanDirectory - file handling', () => {
        it('単一のファイルパスを渡した場合、そのファイルを含むディレクトリ情報を返す', async () => {
            const testFilePath = 'test-file.txt';
            const fileContent = 'test content';
            const fileSize = Buffer.from(fileContent).length;

            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => ({
                isDirectory: () => false,
                isFile: () => true,
                size: fileSize
            } as any));

            mockedFs.readFile.mockResolvedValue(fileContent);

            const result = await fileOps.scanDirectory(testFilePath, defaultOptions);

            // ファイルの親ディレクトリのパスが返される
            expect(result.relativePath).toBe('.');

            // files配列に1件のファイル情報が含まれる
            expect(result.files).toHaveLength(1);
            const fileInfo = result.files[0];
            expect(fileInfo.relativePath).toBe(testFilePath);
            expect(fileInfo.content).toBe(fileContent);
            expect(fileInfo.size).toBe(fileSize);
            expect(fileInfo.language).toBe('plaintext');

            // サブディレクトリは空
            expect(result.directories.size).toBe(0);
        });

        it('ファイルサイズが制限を超える場合、FileSizeLimitErrorを投げる', async () => {
            const testFilePath = 'large-file.txt';
            const maxFileSize = 1024;
            const actualFileSize = maxFileSize + 1;

            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => ({
                isDirectory: () => false,
                isFile: () => true,
                size: actualFileSize
            } as any));

            await expect(fileOps.scanDirectory(testFilePath, {
                ...defaultOptions,
                maxFileSize
            })).rejects.toThrow(FileSizeLimitError);
        });

        it('存在しないファイルパスの場合、ScanErrorを投げる', async () => {
            const nonExistentPath = 'non-existent.txt';

            mockedFs.stat.mockRejectedValue(new Error('ENOENT: no such file or directory'));

            await expect(fileOps.scanDirectory(nonExistentPath, defaultOptions))
                .rejects
                .toThrow(ScanError);
        });
    });

    describe('scanDirectory - error handling', () => {
        it('ファイル読み込みエラーが発生した場合、詳細なエラー情報を含むScanErrorをスローする', async () => {
            const testFilePath = 'error-file.txt';
            const errorMessage = 'EACCES: permission denied';
            
            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => ({
                isDirectory: () => false,
                isFile: () => true,
                size: 100
            } as any));

            mockedFs.readFile.mockRejectedValue(new Error(errorMessage));

            try {
                await fileOps.scanDirectory(testFilePath, defaultOptions);
                fail('エラーがスローされるべき');
            } catch (error) {
                expect(error).toBeInstanceOf(ScanError);
                expect((error as ScanError).message).toContain(errorMessage);
            }
        });

        it('ファイル読み込みエラーが発生した場合、カスタムエラーパラメータを保持する', async () => {
            const testFilePath = 'error-file.txt';
            const customError = new Error(`EACCES: permission denied '${testFilePath}'`);
            (customError as any).code = 'EACCES';
            (customError as any).path = testFilePath;
            
            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => ({
                isDirectory: () => false,
                isFile: () => true,
                size: 100
            } as any));

            mockedFs.readFile.mockRejectedValue(customError);

            try {
                await fileOps.scanDirectory(testFilePath, defaultOptions);
                fail('エラーがスローされるべき');
            } catch (error) {
                expect(error).toBeInstanceOf(ScanError);
                expect((error as ScanError).message).toContain('EACCES');
                expect((error as ScanError).message).toContain(testFilePath);
            }
        });

        it('ファイルサイズ制限を超えた場合、FileSizeLimitErrorをスローする', async () => {
            const largeFilePath = `${workspaceRoot}/test/large-file.ts`;
            mockedFs.stat.mockImplementation(async (filePath: PathLike) => {
                const pathStr = String(filePath);
                if (pathStr === largeFilePath || pathStr.endsWith('large-file.ts')) {
                    return { isDirectory: () => false, isFile: () => true, size: 2000000 } as any;
                }
                return { isDirectory: () => true, isFile: () => false, size: 100 } as any;
            });

            mockedFs.readdir.mockResolvedValue([
                { name: 'large-file.ts', isDirectory: () => false, isFile: () => true }
            ] as unknown as Dirent[]);

            const result = await fileOps.scanDirectory('test', defaultOptions);
            expect(result.files).toHaveLength(0);
        });

        it('fs.readFileが例外を投げた場合、ファイルをスキップする', async () => {
            mockedFs.stat.mockImplementation(async (filePath: PathLike) => {
                const pathStr = String(filePath);
                if (pathStr.endsWith('test')) {
                    return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
                }
                return { isDirectory: () => false, isFile: () => true, size: 100 } as any;
            });

            mockedFs.readdir.mockResolvedValue([
                { name: 'file1.ts', isDirectory: () => false, isFile: () => true },
                { name: 'file2.ts', isDirectory: () => false, isFile: () => true }
            ] as unknown as Dirent[]);

            mockedFs.readFile.mockImplementation(async (path: PathLike | fs.FileHandle, _options?: any) => {
                const pathStr = typeof path === 'string' || Buffer.isBuffer(path) || path instanceof URL ? String(path) : '';
                if (pathStr.endsWith('file2.ts')) {
                    throw new Error('ENOENT: no such file or directory');
                }
                return 'file content';
            });

            const result = await fileOps.scanDirectory('test', defaultOptions);
            expect(result.files).toHaveLength(1);
            expect(result.files[0].relativePath).toBe('test/file1.ts');
        });

        it('カスタムエラーパラメータを持つエラーを適切に処理する', async () => {
            mockedFs.stat.mockImplementation(async (filePath: PathLike) => {
                const pathStr = String(filePath);
                if (pathStr.endsWith('test')) {
                    return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
                }
                return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
            });

            mockedFs.readdir.mockImplementation(async (path: PathLike) => {
                const pathStr = String(path);
                if (pathStr.endsWith('test')) {
                    return [
                        { name: 'error-dir', isDirectory: () => true, isFile: () => false }
                    ] as unknown as Dirent[];
                } else if (pathStr.endsWith('error-dir')) {
                    const customError = new Error('Custom error');
                    (customError as any).params = ['Detailed error message'];
                    throw customError;
                }
                return [] as unknown as Dirent[];
            });

            const result = await fileOps.scanDirectory('test', defaultOptions);
            expect(result.directories.size).toBe(0);
        });

        it('ファイル読み込みエラーの詳細なパラメータを処理する', async () => {
            mockedFs.stat.mockImplementation(async (filePath: PathLike) => {
                const pathStr = String(filePath);
                if (pathStr.endsWith('test')) {
                    return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
                }
                return { isDirectory: () => false, isFile: () => true, size: 100 } as any;
            });

            mockedFs.readdir.mockResolvedValue([
                { name: 'error-file.ts', isDirectory: () => false, isFile: () => true }
            ] as unknown as Dirent[]);

            mockedFs.readFile.mockImplementation(async () => {
                const customError = new Error('Read error');
                (customError as any).params = ['Cannot read file: permission denied'];
                throw customError;
            });

            const result = await fileOps.scanDirectory('test', defaultOptions);
            expect(result.files).toHaveLength(0);
        });

        it('非Errorオブジェクトの例外を適切に処理する', async () => {
            mockedFs.stat.mockImplementation(async (filePath: PathLike) => {
                const pathStr = String(filePath);
                if (pathStr.endsWith('test')) {
                    return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
                }
                return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
            });

            mockedFs.readdir.mockImplementation(async (path: PathLike) => {
                const pathStr = String(path);
                if (pathStr.endsWith('test')) {
                    return [
                        { name: 'error-dir', isDirectory: () => true, isFile: () => false }
                    ] as unknown as Dirent[];
                } else if (pathStr.endsWith('error-dir')) {
                    // 文字列を例外としてスローする
                    throw 'Directory access denied';
                }
                return [] as unknown as Dirent[];
            });

            const result = await fileOps.scanDirectory('test', defaultOptions);
            expect(result.directories.size).toBe(0);
        });
    });

    describe('scanDirectory - exclude patterns', () => {
        it('除外パターンに一致するファイルをスキップする', async () => {
            mockedFs.stat.mockImplementation(async (filePath: PathLike) => {
                const pathStr = String(filePath);
                return {
                    isDirectory: () => pathStr.endsWith('test') || pathStr.endsWith('node_modules'),
                    isFile: () => !pathStr.endsWith('test') && !pathStr.endsWith('node_modules'),
                    size: 100
                } as any;
            });

            mockedFs.readdir.mockImplementation(async (path: PathLike) => {
                const pathStr = String(path);
                // node_modules内部の場合は空配列を返す
                if (pathStr.includes('node_modules') && pathStr.split('/').filter(p => p === 'node_modules').length > 1) {
                    return [] as unknown as Dirent[];
                }
                // トップレベルのディレクトリの場合
                if (pathStr.endsWith('test')) {
                    return [
                        { name: 'file.ts', isDirectory: () => false, isFile: () => true },
                        { name: 'node_modules', isDirectory: () => true, isFile: () => false }
                    ] as unknown as Dirent[];
                }
                return [] as unknown as Dirent[];
            });

            mockedFs.readFile.mockResolvedValue('file content');

            const result = await fileOps.scanDirectory('test', {
                ...defaultOptions,
                excludePatterns: ['**/node_modules/**']
            });

            expect(result.files).toHaveLength(1);
            expect(result.files[0].relativePath).toBe('test/file.ts');
        });

        it('除外パターンに一致するディレクトリ内のファイルをスキップする', async () => {
            mockedFs.stat.mockImplementation(async (filePath: PathLike) => {
                const pathStr = String(filePath);
                return {
                    isDirectory: () => pathStr.endsWith('test') || pathStr.includes('node_modules'),
                    isFile: () => !pathStr.endsWith('test') && !pathStr.includes('node_modules'),
                    size: 100
                } as any;
            });

            mockedFs.readdir.mockImplementation(async (path: PathLike) => {
                const pathStr = String(path);
                // node_modules内部の場合は空配列を返す
                if (pathStr.includes('node_modules') && pathStr.split('/').filter(p => p === 'node_modules').length > 1) {
                    return [] as unknown as Dirent[];
                }
                // トップレベルのnode_modulesの場合
                if (pathStr.endsWith('node_modules')) {
                    return [
                        { name: 'package.json', isDirectory: () => false, isFile: () => true }
                    ] as unknown as Dirent[];
                }
                // トップレベルのディレクトリの場合
                if (pathStr.endsWith('test')) {
                    return [
                        { name: 'file.ts', isDirectory: () => false, isFile: () => true },
                        { name: 'node_modules', isDirectory: () => true, isFile: () => false }
                    ] as unknown as Dirent[];
                }
                return [] as unknown as Dirent[];
            });

            mockedFs.readFile.mockResolvedValue('file content');

            const result = await fileOps.scanDirectory('test', {
                ...defaultOptions,
                excludePatterns: ['**/node_modules/**']
            });

            expect(result.files).toHaveLength(1);
            expect(result.files[0].relativePath).toBe('test/file.ts');
        });
    });

    describe('detectLanguage', () => {
        it('各ファイル拡張子に対して正しい言語を返す', async () => {
            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => ({
                isDirectory: () => _filePath.toString().endsWith('/test'),
                isFile: () => !_filePath.toString().endsWith('/test'),
                size: 100
            } as any));

            mockedFs.readdir.mockImplementation(async (_path: PathLike, _options?: any) => {
                const pathStr = _path.toString();
                if (pathStr === `${workspaceRoot}/test`) {
                    return [
                        { name: 'test.js', isDirectory: () => false, isFile: () => true },
                        { name: 'test.ts', isDirectory: () => false, isFile: () => true },
                        { name: 'test.json', isDirectory: () => false, isFile: () => true },
                        { name: 'test.md', isDirectory: () => false, isFile: () => true },
                        { name: 'test.unknown', isDirectory: () => false, isFile: () => true },
                    ] as unknown as Dirent[];
                }
                return [] as Dirent[];
            });

            mockedFs.readFile.mockResolvedValue('file content');

            const result = await fileOps.scanDirectory('test', defaultOptions);

            const languages = result.files.map(f => f.language);
            expect(languages).toContain('javascript');
            expect(languages).toContain('typescript');
            expect(languages).toContain('json');
            expect(languages).toContain('markdown');
            expect(languages).toContain('plaintext');
        });
    });

    describe('scanDirectory - selected directory handling', () => {
        it('除外パターンに一致するディレクトリを選択した場合、そのディレクトリ自体は処理される', async () => {
            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => {
                const pathStr = String(_filePath);
                if (pathStr.endsWith('/excluded-dir') || pathStr.endsWith('/sub-dir')) {
                    return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
                }
                return { isDirectory: () => false, isFile: () => true, size: 100 } as any;
            });

            mockedFs.readdir.mockImplementation(async (_path: PathLike, _options?: any) => {
                const pathStr = _path.toString();
                if (pathStr === `${workspaceRoot}/excluded-dir`) {
                    return [
                        { name: 'test-file.txt', isDirectory: () => false, isFile: () => true },
                        { name: 'sub-dir', isDirectory: () => true, isFile: () => false },
                    ] as unknown as Dirent[];
                } else if (pathStr === `${workspaceRoot}/excluded-dir/sub-dir`) {
                    return [
                        { name: 'sub-file.txt', isDirectory: () => false, isFile: () => true }
                    ] as unknown as Dirent[];
                }
                return [] as Dirent[];
            });

            mockedFs.readFile.mockResolvedValue('file content');

            const result = await fileOps.scanDirectory('excluded-dir', {
                ...defaultOptions,
                excludePatterns: ['excluded-dir/**']
            });

            // 選択されたディレクトリ自体は処理される
            expect(result.relativePath).toBe('excluded-dir');
            
            // サブファイルも処理される
            expect(result.files).toHaveLength(1);
            expect(result.files[0].relativePath).toBe('excluded-dir/test-file.txt');
            
            // サブディレクトリも処理される
            expect(result.directories.size).toBe(1);
            expect(result.directories.has('sub-dir')).toBe(true);
        });

        it('除外パターンに一致するディレクトリを選択した場合と親ディレクトリから走査した場合で動作が異なる', async () => {
            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => {
                const pathStr = String(_filePath);
                if (pathStr.endsWith('/test') || pathStr.includes('excluded-dir')) {
                    return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
                }
                return { isDirectory: () => false, isFile: () => true, size: 100 } as any;
            });

            mockedFs.readdir.mockImplementation(async (_path: PathLike, _options?: any) => {
                const pathStr = _path.toString();
                if (pathStr === `${workspaceRoot}/test`) {
                    return [
                        { name: 'excluded-dir', isDirectory: () => true, isFile: () => false },
                        { name: 'src', isDirectory: () => true, isFile: () => false },
                    ] as unknown as Dirent[];
                } else if (pathStr.includes('excluded-dir')) {
                    return [
                        { name: 'test-file.txt', isDirectory: () => false, isFile: () => true }
                    ] as unknown as Dirent[];
                }
                return [] as Dirent[];
            });

            mockedFs.readFile.mockResolvedValue('file content');

            // 対象のディレクトリを直接選択した場合
            const resultDirect = await fileOps.scanDirectory('test/excluded-dir', {
                ...defaultOptions,
                excludePatterns: ['excluded-dir/**']
            });

            // ファイルが処理される
            expect(resultDirect.files).toHaveLength(1);
            expect(resultDirect.files[0].relativePath).toBe('test/excluded-dir/test-file.txt');

            // 親ディレクトリを選択した場合
            const resultParent = await fileOps.scanDirectory('test', {
                ...defaultOptions,
                excludePatterns: ['excluded-dir/**']
            });

            // 除外対象のディレクトリは処理されない
            expect(resultParent.directories.size).toBe(1);
            expect(resultParent.directories.has('src')).toBe(true);
            expect(resultParent.directories.has('excluded-dir')).toBe(false);
        });
    });

    describe('scanDirectory - path normalization', () => {
        it('相対パスと絶対パスで同じ動作をする', async () => {
            const relativePath = 'test/dir';
            const absolutePath = `${workspaceRoot}/test/dir`;

            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => ({
                isDirectory: () => true,
                isFile: () => false,
                size: 0
            } as any));

            mockedFs.readdir.mockImplementation(async (_path: PathLike, _options?: any) => {
                return [
                    { name: 'test.txt', isDirectory: () => false, isFile: () => true }
                ] as unknown as Dirent[];
            });

            mockedFs.readFile.mockResolvedValue('test content');

            const resultRelative = await fileOps.scanDirectory(relativePath, defaultOptions);
            const resultAbsolute = await fileOps.scanDirectory(absolutePath, defaultOptions);

            expect(resultRelative.files).toHaveLength(1);
            expect(resultAbsolute.files).toHaveLength(1);
            expect(resultRelative.files[0].relativePath).toBe(resultAbsolute.files[0].relativePath);
        });

        it('除外パターンは常にワークスペースルートからの相対パスに対して評価される', async () => {
            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => {
                const pathStr = String(_filePath);
                return {
                    isDirectory: () => pathStr.endsWith('/dir'),
                    isFile: () => !pathStr.endsWith('/dir'),
                    size: 0
                } as any;
            });

            mockedFs.readdir.mockImplementation(async (_path: PathLike, _options?: any) => {
                return [
                    { name: 'test.txt', isDirectory: () => false, isFile: () => true }
                ] as unknown as Dirent[];
            });

            mockedFs.readFile.mockResolvedValue('test content');

            const result = await fileOps.scanDirectory('subdir/dir', {
                ...defaultOptions,
                excludePatterns: ['subdir/**']
            });

            // 選択されたディレクトリ自体は除外パターンに一致しても処理される
            expect(result.files).toHaveLength(1);
            expect(result.files[0].relativePath).toBe('subdir/dir/test.txt');
        });
    });

    describe('shouldExclude - edge cases', () => {
        it('選択されたディレクトリ自体は除外パターンに一致しても除外しない', async () => {
            mockedFs.stat.mockImplementation(async (filePath: PathLike) => {
                const pathStr = String(filePath);
                if (pathStr.endsWith('node_modules')) {
                    return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
                }
                return { isDirectory: () => false, isFile: () => true, size: 100 } as any;
            });

            mockedFs.readdir.mockImplementation(async (path: PathLike) => {
                const pathStr = String(path);
                if (pathStr.includes('node_modules') && pathStr.split('/').filter(p => p === 'node_modules').length > 1) {
                    return [] as unknown as Dirent[];
                }
                if (pathStr.endsWith('node_modules')) {
                    return [
                        { name: 'package.json', isDirectory: () => false, isFile: () => true }
                    ] as unknown as Dirent[];
                }
                return [] as unknown as Dirent[];
            });

            mockedFs.readFile.mockResolvedValue('file content');

            const result = await fileOps.scanDirectory('node_modules', {
                ...defaultOptions,
                excludePatterns: ['**/node_modules/**']
            });

            expect(result.files).toHaveLength(1);
            expect(result.files[0].relativePath).toBe('node_modules/package.json');
        });

        it('currentSelectedPathがnullの場合も正しく動作する', async () => {
            const newFileOps = new FileOperations(workspaceRoot);

            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => {
                const pathStr = String(_filePath);
                return {
                    isDirectory: () => pathStr.endsWith('node_modules'),
                    isFile: () => !pathStr.endsWith('node_modules'),
                    size: 0
                } as any;
            });

            mockedFs.readdir.mockImplementation(async (path: PathLike) => {
                const pathStr = String(path);
                if (pathStr.includes('node_modules') && pathStr.split('/').filter(p => p === 'node_modules').length > 1) {
                    return [] as unknown as Dirent[];
                }
                if (pathStr.endsWith('test')) {
                    return [
                        { name: 'node_modules', isDirectory: () => true, isFile: () => false }
                    ] as unknown as Dirent[];
                }
                return [] as unknown as Dirent[];
            });

            const result = await newFileOps.scanDirectory('test', {
                ...defaultOptions,
                excludePatterns: ['**/node_modules/**']
            });

            expect(result.directories.size).toBe(0);
        });

        it('currentSelectedPathが空文字列の場合も正しく動作する', async () => {
            const newFileOps = new FileOperations(workspaceRoot);
            // currentSelectedPathを空文字列に設定（privateプロパティなので、anyにキャストして設定）
            (newFileOps as any).currentSelectedPath = '';

            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => ({
                isDirectory: () => true,
                isFile: () => false,
                size: 0
            } as any));

            mockedFs.readdir.mockResolvedValue([
                { name: 'test.txt', isDirectory: () => false, isFile: () => true }
            ] as unknown as Dirent[]);

            const result = await newFileOps.scanDirectory('test', {
                ...defaultOptions,
                excludePatterns: ['test.txt']
            });

            // ファイルが除外される
            expect(result.files).toHaveLength(0);
        });

        it('currentSelectedPathがundefinedの場合も正しく動作する', async () => {
            // FileOperationsインスタンスを新しく作成（currentSelectedPathはundefined）
            const newFileOps = new FileOperations(workspaceRoot);

            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => ({
                isDirectory: () => true,
                isFile: () => false,
                size: 0
            } as any));

            mockedFs.readdir.mockResolvedValue([
                { name: 'test.txt', isDirectory: () => false, isFile: () => true }
            ] as unknown as Dirent[]);

            const result = await newFileOps.scanDirectory('test', {
                ...defaultOptions,
                excludePatterns: ['test.txt']
            });

            // ファイルが除外される
            expect(result.files).toHaveLength(0);
        });
    });

    describe('shouldExclude - error handling', () => {
        it('minimatchがエラーを投げた場合でも適切に処理する', async () => {
            // 不正な正規表現パターンを含む除外パターン
            const invalidPattern = '['; // 不正な正規表現パターン
            
            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => ({
                isDirectory: () => true,
                isFile: () => false,
                size: 0
            } as any));

            mockedFs.readdir.mockResolvedValue([
                { name: 'test.txt', isDirectory: () => false, isFile: () => true }
            ] as unknown as Dirent[]);

            const result = await fileOps.scanDirectory('test', {
                ...defaultOptions,
                excludePatterns: [invalidPattern]
            });

            // エラーが発生しても処理は継続され、ファイルは除外されない
            expect(result.files).toHaveLength(1);
        });
    });

    describe('gitignore integration', () => {
        beforeEach(() => {
            fileOps = new FileOperations(workspaceRoot);
            jest.clearAllMocks();
            
            // .gitignoreファイルのモック
            mockedFs.readFile.mockImplementation(async (_path, _options?) => {
                if (String(_path).endsWith('.gitignore')) {
                    return Buffer.from('node_modules/\n# コメント行\ndist/\n.DS_Store\n*.log');
                }
                return Buffer.from('file content');
            });
        });
        
        it('useGitignoreオプションの有効/無効で正しく動作する', async () => {
            // Arrange
            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => ({
                isDirectory: () => true,
                isFile: () => false,
                size: 0
            } as any));
            
            const testFiles = [
                { name: 'test.log', isDirectory: () => false, isFile: () => true },
                { name: 'dist', isDirectory: () => true, isFile: () => false },
                { name: 'regular.txt', isDirectory: () => false, isFile: () => true },
            ] as unknown as Dirent[];
            
            mockedFs.readdir.mockImplementation(async () => testFiles);
            
            // Act: useGitignore = false
            const resultWithoutGitignore = await fileOps.scanDirectory('test', {
                maxFileSize: 1048576,
                excludePatterns: [],
                useGitignore: false
            });
            
            // Assert: useGitignore = false
            expect(resultWithoutGitignore.directories.size).toBe(1);
            expect(resultWithoutGitignore.files.length).toBe(2);
            
            // Reset mocks
            jest.clearAllMocks();
            mockedFs.readdir.mockImplementation(async () => testFiles);
            mockedFs.readFile.mockImplementation(async (_path, _options?) => {
                if (String(_path).endsWith('.gitignore')) {
                    return Buffer.from('node_modules/\n# コメント行\ndist/\n.DS_Store\n*.log');
                }
                return Buffer.from('file content');
            });
            
            // Act: useGitignore = true
            const resultWithGitignore = await fileOps.scanDirectory('test', {
                maxFileSize: 1048576,
                excludePatterns: [],
                useGitignore: true
            });
            
            // Assert: useGitignore = true (.gitignoreのパターンでdistディレクトリとtest.logファイルが除外される)
            expect(resultWithGitignore.directories.size).toBe(0);
            expect(resultWithGitignore.files.length).toBe(1);
            expect(resultWithGitignore.files[0].relativePath).toContain('regular.txt');
        });
        
        it('.gitignoreが有効の場合、パターンが適用される', async () => {
            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => ({
                isDirectory: () => String(_filePath).endsWith('/test') || String(_filePath).endsWith('/dist'),
                isFile: () => !String(_filePath).endsWith('/test') && !String(_filePath).endsWith('/dist'),
                size: 0
            } as any));
            
            mockedFs.readdir.mockImplementation(async (_path: PathLike) => {
                const pathStr = String(_path);
                if (pathStr === `${workspaceRoot}/test`) {
                    return [
                        { name: 'test.log', isDirectory: () => false, isFile: () => true },
                        { name: 'dist', isDirectory: () => true, isFile: () => false },
                        { name: 'regular.txt', isDirectory: () => false, isFile: () => true },
                    ] as unknown as Dirent[];
                } else if (pathStr === `${workspaceRoot}/test/dist`) {
                    return [
                        { name: 'bundle.js', isDirectory: () => false, isFile: () => true }
                    ] as unknown as Dirent[];
                }
                return [] as unknown as Dirent[];
            });
            
            const result = await fileOps.scanDirectory('test', {
                maxFileSize: 1048576,
                excludePatterns: [],
                useGitignore: true
            });
            
            // .gitignoreが有効なので、dist/とtest.logは除外される
            expect(result.directories.size).toBe(0); // distディレクトリは.gitignoreで除外
            expect(result.files.length).toBe(1);
            expect(result.files[0].relativePath).toContain('regular.txt');
        });
        
        it('.gitignoreに加えて除外パターンも適用される', async () => {
            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => ({
                isDirectory: () => String(_filePath).endsWith('/test'),
                isFile: () => !String(_filePath).endsWith('/test'),
                size: 0
            } as any));
            
            mockedFs.readdir.mockImplementation(async (_path: PathLike) => {
                return [
                    { name: 'test.log', isDirectory: () => false, isFile: () => true },
                    { name: 'regular.txt', isDirectory: () => false, isFile: () => true },
                    { name: 'custom.exclude', isDirectory: () => false, isFile: () => true },
                ] as unknown as Dirent[];
            });
            
            const result = await fileOps.scanDirectory('test', {
                maxFileSize: 1048576,
                excludePatterns: ['*.exclude'],
                useGitignore: true
            });
            
            // .gitignoreパターン(*.log)と除外パターン(*.exclude)の両方が適用される
            expect(result.files.length).toBe(1);
            expect(result.files[0].relativePath).toContain('regular.txt');
        });
    });
}); 