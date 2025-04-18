import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { MarkdownGenerator } from '../markdownGenerator';
import { DirectoryStructure } from '../directoryStructure';
import { DirectoryInfo } from '../types/fileTypes';

jest.mock('vscode');
jest.mock('../directoryStructure');

describe('MarkdownGenerator', () => {
    let markdownGenerator: MarkdownGenerator;
    let mockDirectoryStructure: jest.Mocked<DirectoryStructure>;
    let mockConfig: { get: jest.Mock };

    beforeEach(() => {
        jest.clearAllMocks();

        mockDirectoryStructure = new DirectoryStructure() as jest.Mocked<DirectoryStructure>;
        mockDirectoryStructure.generate.mockImplementation((dirs) => {
            if (dirs.length === 0) return '';
            return '# Directory Structure\n📁 test\n  📄 file1.ts\n  📁 src\n    📄 main.ts\n';
        });

        mockConfig = { get: jest.fn() };
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

        markdownGenerator = new MarkdownGenerator(mockDirectoryStructure);
    });

    describe('generate', () => {
        const mockDirectoryInfo: DirectoryInfo = {
            uri: { fsPath: '/test/path' } as vscode.Uri,
            relativePath: 'test/path',
            files: [{
                uri: { fsPath: '/test/path/file.txt' } as vscode.Uri,
                relativePath: 'test/path/file.txt',
                content: 'test content',
                size: 1024,
                language: 'plaintext'
            }],
            directories: new Map()
        };

        test('空のディレクトリリストの場合、空文字列を返すこと', async () => {
            const result = await markdownGenerator.generate([]);
            expect(result).toBe('');
        });

        test('固定文言が設定されていない場合、通常の出力を生成すること', async () => {
            mockConfig.get.mockReturnValue('');

            const result = await markdownGenerator.generate([mockDirectoryInfo]);

            expect(result).toContain('# Directory Structure');
            expect(result).toContain('# File Contents');
            expect(result).not.toMatch(/^.+\n# Directory Structure/);
        });

        test('固定文言が設定されている場合、先頭に追加されること', async () => {
            const prefixText = '# Project Overview\nThis is a test project.';
            mockConfig.get.mockReturnValue(prefixText);

            const result = await markdownGenerator.generate([mockDirectoryInfo]);

            expect(result).toMatch(/^# Project Overview\nThis is a test project.\n/);
            expect(result).toContain('# Directory Structure');
            expect(result).toContain('# File Contents');
        });

        test('ファイルサイズが適切にフォーマットされること', async () => {
            const files = [
                { size: 500, expected: '500 B' },
                { size: 1024, expected: '1 KB' },
                { size: 1536, expected: '1.5 KB' },
                { size: 1048576, expected: '1 MB' },
                { size: 1073741824, expected: '1 GB' }
            ];

            for (const { size, expected } of files) {
                const directoryInfo: DirectoryInfo = {
                    ...mockDirectoryInfo,
                    files: [{
                        ...mockDirectoryInfo.files[0],
                        size
                    }]
                };

                const result = await markdownGenerator.generate([directoryInfo]);
                expect(result).toContain(`Size: ${expected}`);
            }
        });
    });

    it('単一のファイルを含むディレクトリを正しく処理する', async () => {
        const dir: DirectoryInfo = {
            uri: vscode.Uri.file('/test'),
            relativePath: 'test',
            files: [
                {
                    uri: vscode.Uri.file('/test/file1.ts'),
                    relativePath: 'test/file1.ts',
                    content: 'console.log("Hello");',
                    language: 'typescript',
                    size: 100
                }
            ],
            directories: new Map()
        };

        const result = await markdownGenerator.generate([dir]);
        
        // ディレクトリ構造のセクション
        expect(result).toContain('# Directory Structure');
        expect(result).toContain('📁 test');
        expect(result).toContain('📄 file1.ts');

        // ファイル内容のセクション
        expect(result).toContain('# File Contents');
        expect(result).toContain('## test/file1.ts');
        expect(result).toContain('- Size: 100 B');
        expect(result).toContain('- Language: typescript');
        expect(result).toContain('```typescript');
        expect(result).toContain('console.log("Hello");');
    });

    it('複数のファイルとディレクトリを正しく処理する', async () => {
        const subDir: DirectoryInfo = {
            uri: vscode.Uri.file('/test/src'),
            relativePath: 'test/src',
            files: [
                {
                    uri: vscode.Uri.file('/test/src/main.ts'),
                    relativePath: 'test/src/main.ts',
                    content: 'export const main = () => {};',
                    language: 'typescript',
                    size: 200
                }
            ],
            directories: new Map()
        };

        const dir: DirectoryInfo = {
            uri: vscode.Uri.file('/test'),
            relativePath: 'test',
            files: [
                {
                    uri: vscode.Uri.file('/test/README.md'),
                    relativePath: 'test/README.md',
                    content: '# Test Project',
                    language: 'markdown',
                    size: 100
                }
            ],
            directories: new Map([['src', subDir]])
        };

        mockDirectoryStructure.generate.mockReturnValue('# Directory Structure\n📁 test\n  📄 README.md\n  📁 src\n    📄 main.ts\n');
        const result = await markdownGenerator.generate([dir]);
        
        // ディレクトリ構造の検証
        expect(result).toContain('📁 test');
        expect(result).toContain('📄 README.md');
        expect(result).toContain('📁 src');
        expect(result).toContain('📄 main.ts');

        // ファイル内容の検証
        expect(result).toContain('## test/README.md');
        expect(result).toContain('```markdown');
        expect(result).toContain('# Test Project');

        expect(result).toContain('## test/src/main.ts');
        expect(result).toContain('```typescript');
        expect(result).toContain('export const main = () => {};');
    });

    it('ファイルサイズを適切にフォーマットする', async () => {
        const dir: DirectoryInfo = {
            uri: vscode.Uri.file('/test'),
            relativePath: 'test',
            files: [
                {
                    uri: vscode.Uri.file('/test/small.txt'),
                    relativePath: 'test/small.txt',
                    content: 'Small file',
                    language: 'plaintext',
                    size: 512
                },
                {
                    uri: vscode.Uri.file('/test/medium.txt'),
                    relativePath: 'test/medium.txt',
                    content: 'Medium file',
                    language: 'plaintext',
                    size: 1024 * 100
                },
                {
                    uri: vscode.Uri.file('/test/large.txt'),
                    relativePath: 'test/large.txt',
                    content: 'Large file',
                    language: 'plaintext',
                    size: 1024 * 1024 * 2
                }
            ],
            directories: new Map()
        };

        const result = await markdownGenerator.generate([dir]);
        
        expect(result).toContain('- Size: 512 B');
        expect(result).toContain('- Size: 100 KB');
        expect(result).toContain('- Size: 2 MB');
    });

    it('ファイルサイズが1024の倍数の場合、小数点以下を表示しない', async () => {
        const dir: DirectoryInfo = {
            uri: vscode.Uri.file('/test'),
            relativePath: 'test',
            files: [
                {
                    uri: vscode.Uri.file('/test/exact.txt'),
                    relativePath: 'test/exact.txt',
                    content: 'Exact size file',
                    language: 'plaintext',
                    size: 1024
                },
                {
                    uri: vscode.Uri.file('/test/exact_mb.txt'),
                    relativePath: 'test/exact_mb.txt',
                    content: 'Exact MB size file',
                    language: 'plaintext',
                    size: 1024 * 1024
                }
            ],
            directories: new Map()
        };

        const result = await markdownGenerator.generate([dir]);
        
        expect(result).toContain('- Size: 1 KB');
        expect(result).toContain('- Size: 1 MB');
    });
}); 