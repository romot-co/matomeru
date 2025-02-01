import * as fs from 'fs/promises';
import { FileOperations } from '../fileOperations';
import { ScanOptions } from '../types/fileTypes';
import { DirectoryNotFoundError } from '../errors/errors';
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

            mockedFs.stat.mockImplementation(async (filePath: PathLike) => {
                const pathStr = String(filePath);
                if (pathStr.endsWith('/test') || pathStr.endsWith('/dir1')) {
                    return { isDirectory: () => true, size: 0 } as any;
                }
                return { isDirectory: () => false, size: 100 } as any;
            });

            mockedFs.readFile.mockResolvedValue('file content');

            const result = await fileOps.scanDirectory('test', defaultOptions);

            expect(result.files).toHaveLength(1);
            expect(result.directories.size).toBe(1);
            expect(result.files[0].language).toBe('typescript');
            expect(mockedFs.readdir).toHaveBeenCalledTimes(2);
        });

        it('空のディレクトリを正しく処理する', async () => {
            mockedFs.readdir.mockImplementation(async (_path: PathLike, _options?: any) => {
                return [] as Dirent[];
            });

            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => ({
                isDirectory: () => true,
                size: 0
            } as any));

            const result = await fileOps.scanDirectory('empty', defaultOptions);

            expect(result.files).toHaveLength(0);
            expect(result.directories.size).toBe(0);
            expect(mockedFs.readdir).toHaveBeenCalledTimes(1);
        });
    });

    describe('scanDirectory - exclusion patterns', () => {
        it('除外パターンに一致するファイル/ディレクトリをスキップする', async () => {
            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => ({
                isDirectory: () => true,
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
                isDirectory: () => true,
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
            mockedFs.stat.mockImplementation(async (filePath: PathLike) => ({
                isDirectory: () => filePath.toString().endsWith('/test'),
                size: String(filePath).includes('large') ? 2000000 : 1000
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
            mockedFs.stat.mockImplementation(async (filePath: PathLike) => ({
                isDirectory: () => filePath.toString().endsWith('/test'),
                size: String(filePath).includes('over') ? 1048577 : 1048576
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

    describe('scanDirectory - error handling', () => {
        it('エラー時に適切なエラーメッセージを投げる', async () => {
            mockedFs.stat.mockRejectedValue(new Error('Access denied'));

            await expect(fileOps.scanDirectory('test', defaultOptions))
                .rejects
                .toThrow('msg.scanError');
        });

        it('ディレクトリでないパスを処理する際にエラーを投げる', async () => {
            mockedFs.stat.mockResolvedValue({
                isDirectory: () => false,
                size: 0
            } as any);

            await expect(fileOps.scanDirectory('file.txt', defaultOptions))
                .rejects
                .toThrow(DirectoryNotFoundError);
        });

        it('サブディレクトリのエラーを適切に処理する', async () => {
            mockedFs.stat.mockImplementation(async (_filePath: PathLike) => ({
                isDirectory: () => true,
                size: 0
            } as any));

            mockedFs.readdir.mockImplementation(async (_path: PathLike, _options?: any) => {
                const pathStr = _path.toString();
                if (pathStr === `${workspaceRoot}/test`) {
                    return [
                        { name: 'dir1', isDirectory: () => true, isFile: () => false },
                        { name: 'file1.ts', isDirectory: () => false, isFile: () => true },
                    ] as unknown as Dirent[];
                }
                return [] as Dirent[];
            });

            mockedFs.readFile.mockResolvedValue('file content');

            const result = await fileOps.scanDirectory('test', defaultOptions);

            expect(result.files).toHaveLength(1);
            expect(result.directories.size).toBe(1);
        });
    });

    describe('detectLanguage', () => {
        it('各ファイル拡張子に対して正しい言語を返す', async () => {
            mockedFs.stat.mockImplementation(async (filePath: PathLike) => ({
                isDirectory: () => filePath.toString().endsWith('/test'),
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
}); 