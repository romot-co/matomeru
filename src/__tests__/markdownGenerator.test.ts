import * as vscode from 'vscode';
import { MarkdownGenerator } from '../markdownGenerator';
import { DirectoryInfo } from '../types/fileTypes';

describe('MarkdownGenerator', () => {
    let markdownGenerator: MarkdownGenerator;

    beforeEach(() => {
        markdownGenerator = new MarkdownGenerator();
    });

    it('空のディレクトリリストに対して空文字列を返す', () => {
        const result = markdownGenerator.generate([]);
        expect(result).toBe('');
    });

    it('単一のファイルを含むディレクトリを正しく処理する', () => {
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

        const result = markdownGenerator.generate([dir]);
        
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

    it('複数のファイルとディレクトリを正しく処理する', () => {
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

        const result = markdownGenerator.generate([dir]);
        
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

    it('ファイルサイズを適切にフォーマットする', () => {
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

        const result = markdownGenerator.generate([dir]);
        
        expect(result).toContain('- Size: 512 B');
        expect(result).toContain('- Size: 100 KB');
        expect(result).toContain('- Size: 2 MB');
    });

    it('ファイルサイズが1024の倍数の場合、小数点以下を表示しない', () => {
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

        const result = markdownGenerator.generate([dir]);
        
        expect(result).toContain('- Size: 1 KB');
        expect(result).toContain('- Size: 1 MB');
    });
}); 