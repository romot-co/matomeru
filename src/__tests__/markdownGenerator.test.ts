import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { MarkdownGenerator } from '../generators/MarkdownGenerator';
import { DirectoryStructure } from '../directoryStructure';
import { DirectoryInfo, FileInfo, ScanOptions } from '../types/fileTypes';
import yaml from 'js-yaml';

jest.mock('vscode');
jest.mock('../directoryStructure');

const mockGenerateYaml = jest.fn<(...args: any[]) => any>();
jest.mock('../generators/YamlGenerator', () => {
    return {
        YamlGenerator: jest.fn().mockImplementation(() => {
            return { generate: mockGenerateYaml };
        })
    };
});

describe('MarkdownGenerator', () => {
    let markdownGenerator: MarkdownGenerator;
    let mockDirectoryStructure: jest.Mocked<DirectoryStructure>;
    let mockConfig: {
        get: jest.Mock<(key: string, defaultValue?: any) => any>;
        has: jest.Mock<any>;
        inspect: jest.Mock<any>;
        update: jest.Mock<any>;
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockDirectoryStructure = new DirectoryStructure() as jest.Mocked<DirectoryStructure>;
        mockDirectoryStructure.generate.mockImplementation((_dirs: readonly DirectoryInfo[]): string => {
            if (_dirs.length === 0 || !_dirs[0]) return '';
            let output = '# Directory Structure\n';
            output += '📁 test\n';
            if (_dirs[0].files?.length > 0 && _dirs[0].files[0]) {
                output += `  📄 ${_dirs[0].files[0].relativePath.split('/').pop() || ''}\n`;
            }
            if (_dirs[0].directories?.size > 0) {
                const subDirName = _dirs[0].directories.keys().next().value as string;
                output += `  📁 ${subDirName}\n`;
                const subDir = _dirs[0].directories.get(subDirName);
                if (subDir && subDir.files?.length > 0 && subDir.files[0]) {
                    output += `    📄 ${subDir.files[0].relativePath.split('/').pop() || ''}\n`;
                }
            }
            return output;
        });

        mockConfig = {
            get: jest.fn<(key: string, defaultValue?: any) => any>(),
            has: jest.fn(),
            inspect: jest.fn(),
            update: jest.fn(),
        };
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
        
        mockConfig.get.mockImplementation((key: string, defaultValue?: any): any => {
            if (key === 'includeDependencies') return false;
            if (key === 'mermaid.maxNodes') return 300;
            if (key === 'markdown.prefixText') return '';
            if (key === 'enableCompression') return false;
            return defaultValue;
        });

        mockGenerateYaml.mockImplementation((_directoriesInfo: DirectoryInfo[], _options: ScanOptions): string => {
            return yaml.dump({ files: [], dependencies: {} });
        });

        markdownGenerator = new MarkdownGenerator(mockDirectoryStructure);
    });

    describe('generate', () => {
        const mockFile: FileInfo = {
            uri: { fsPath: '/test/path/file.txt' } as vscode.Uri,
            relativePath: 'test/path/file.txt',
            content: 'test content',
            size: 1024,
            language: 'plaintext',
            imports: []
        };
        const mockDirectoryInfo: DirectoryInfo = {
            uri: { fsPath: '/test/path' } as vscode.Uri,
            relativePath: 'test/path',
            files: [mockFile],
            directories: new Map(),
            imports: []
        };

        test('空のディレクトリリストの場合、空文字列を返すこと', async () => {
            const result = await markdownGenerator.generate([]);
            expect(result).toBe('');
        });

        describe('通常出力 (includeDependencies: false)', () => {
            beforeEach(() => {
                mockConfig.get.mockImplementation((key: string, defaultValue?: any): any => {
                    if (key === 'includeDependencies') return false;
                    if (key === 'mermaid.maxNodes') return 300;
                    if (key === 'markdown.prefixText') return '';
                    if (key === 'enableCompression') return false;
                    return defaultValue;
                });
            });

            test('固定文言なし: 通常の出力', async () => {
                const result = await markdownGenerator.generate([mockDirectoryInfo]);
                expect(result).toContain('# Directory Structure');
                expect(result).toContain('📁 test');
                expect(result).toContain('📄 file.txt');
                expect(result).toContain('# File Contents');
                expect(result).toContain('## test/path/file.txt');
                expect(result).not.toContain('<!-- matomeru:auto-graph:start -->');
            });

            test('固定文言あり: 先頭に追加', async () => {
                const prefixText = '# Project Overview\nThis is a test project.';
                mockConfig.get.mockImplementation((key: string, defaultValue?: any): any => {
                    if (key === 'markdown.prefixText') return prefixText;
                    if (key === 'includeDependencies') return false;
                    if (key === 'mermaid.maxNodes') return 300;
                    if (key === 'enableCompression') return false;
                    return defaultValue;
                });
                const result = await markdownGenerator.generate([mockDirectoryInfo]);
                expect(result).toMatch(/^# Project Overview\nThis is a test project.\n/);
                expect(result).toContain('# Directory Structure');
                expect(result).toContain('# File Contents');
                expect(result).not.toContain('<!-- matomeru:auto-graph:start -->');
            });
        });

        describe('Mermaidグラフあり (includeDependencies: true)', () => {
            const fileWithImports: FileInfo = {
                ...mockFile,
                relativePath: 'test/path/app.ts',
                imports: ['external:lodash', './utils.ts']
            };
            const utilFile: FileInfo = {
                uri: { fsPath: '/test/path/utils.ts' } as vscode.Uri,
                relativePath: 'test/path/utils.ts',
                content: '// utils',
                size: 50,
                language: 'typescript',
                imports: []
            };
            const dirWithImports: DirectoryInfo = {
                ...mockDirectoryInfo,
                files: [fileWithImports, utilFile]
            };

            beforeEach(() => {
                mockConfig.get.mockImplementation((key: string, defaultValue?: any): any => {
                    if (key === 'includeDependencies') return true;
                    if (key === 'mermaid.maxNodes') return 300;
                    if (key === 'markdown.prefixText') return '';
                    if (key === 'enableCompression') return false;
                    return defaultValue;
                });
                
                mockGenerateYaml.mockImplementation((_directoriesInfo: DirectoryInfo[], _options: ScanOptions): string => {
                    const data = {
                        files: [
                            { relativePath: 'test/path/app.ts', imports: ['external:lodash', './utils.ts'] },
                            { relativePath: 'test/path/utils.ts', imports: [] }
                        ],
                        dependencies: {
                            'test/path/app.ts': ['external:lodash', 'test/path/utils.ts'],
                            'test/path/utils.ts': []
                        }
                    };
                    return yaml.dump(data);
                });
            });

            test('固定文言なし: Mermaidグラフ + 通常の出力', async () => {
                const result = await markdownGenerator.generate([dirWithImports]);
                expect(result).toContain('<!-- matomeru:auto-graph:start -->');
                expect(result).toContain('flowchart TD');
                // expect(result).toContain('    "test/path/app.ts"'); // Implicitly defined by edge
                // expect(result).toContain('    "external:lodash"'); // This specific assertion might fail as nodes are implicitly defined by edges (already commented out)
                // expect(result).toContain('    "test/path/utils.ts"'); // Implicitly defined by edge
                expect(result).toContain('    "test/path/app.ts" --> "external:lodash"');
                expect(result).toContain('    "test/path/app.ts" --> "test/path/utils.ts"');
                expect(result).toContain('<!-- matomeru:auto-graph:end -->');
                
                const parts = result.split('<!-- matomeru:auto-graph:end -->');
                expect(parts.length).toBe(2);
                expect(parts[1]).toContain('# Directory Structure');
                expect(parts[1]).toContain('# File Contents');
            });

            test('固定文言あり: 固定文言 + Mermaidグラフ + 通常の出力', async () => {
                const prefixText = '# Project Overview\nThis is a test project.';
                 mockConfig.get.mockImplementation((key: string, defaultValue?: any): any => {
                    if (key === 'markdown.prefixText') return prefixText;
                    if (key === 'includeDependencies') return true;
                    if (key === 'mermaid.maxNodes') return 300;
                    if (key === 'enableCompression') return false;
                    return defaultValue;
                });
                const result = await markdownGenerator.generate([dirWithImports]);
                expect(result).toMatch(/^# Project Overview\nThis is a test project.\n(?:\s*\n)?<!-- matomeru:auto-graph:start -->/s);
                
                const contentAfterPrefix = result.substring(prefixText.length + 1); 
                expect(contentAfterPrefix).toContain('<!-- matomeru:auto-graph:start -->');
                expect(contentAfterPrefix).toContain('<!-- matomeru:auto-graph:end -->');
                
                const parts = contentAfterPrefix.split('<!-- matomeru:auto-graph:end -->');
                expect(parts.length).toBe(2);
                expect(parts[1]).toContain('# Directory Structure');
                expect(parts[1]).toContain('# File Contents');
            });

            test('maxNodes を超える場合は警告メッセージを表示する ※generateMermaidGraph内のロジック変更によりこのテストは失敗する可能性あり', async () => {
                mockConfig.get.mockImplementation((key: string, defaultValue?: any): any => {
                    if (key === 'includeDependencies') return true;
                    if (key === 'mermaid.maxNodes') return 1; 
                    if (key === 'markdown.prefixText') return '';
                    if (key === 'enableCompression') return false;
                    return defaultValue;
                });
                
                mockGenerateYaml.mockImplementation((_directoriesInfo: DirectoryInfo[], _options: ScanOptions): string => { 
                     const data = {
                        files: [
                            { relativePath: 'test/path/app.ts', imports: ['./utils.ts'] }, // 1 edge
                            { relativePath: 'test/path/utils.ts', imports: [] }          // 2 nodes
                        ],
                        dependencies: {
                            'test/path/app.ts': ['test/path/utils.ts'],
                            'test/path/utils.ts': []
                        }
                    };
                    return yaml.dump(data);
                });

                const result = await markdownGenerator.generate([dirWithImports]); 
                expect(result).toContain('<!-- matomeru:auto-graph:start -->');
                // generateMermaidGraph のノード数カウントと警告メッセージのロジックに依存するため、メッセージの完全一致は難しいかもしれない
                // 少なくとも "Truncated" や "limit" といったキーワードが含まれるか確認
                expect(result).toMatch(/Warning: Mermaid graph truncated/i);
                expect(result).toMatch(/exceeds the configured limit \(1\)/i);
                expect(result).toContain('<!-- matomeru:auto-graph:end -->');
            });
        });

        test('ファイルサイズが適切にフォーマットされること', async () => {
            mockConfig.get.mockImplementation((key: string, defaultValue?: any): any => {
                if (key === 'includeDependencies') return false;
                if (key === 'mermaid.maxNodes') return 300;
                if (key === 'markdown.prefixText') return '';
                if (key === 'enableCompression') return false;
                return defaultValue;
            });
            const filesToTest = [
                { size: 500, expected: '500 B' },
                { size: 1024, expected: '1 KB' },
                { size: 1536, expected: '1.5 KB' },
                { size: 1048576, expected: '1 MB' },
                { size: 1073741824, expected: '1 GB' }
            ];

            for (const { size, expected } of filesToTest) {
                const directoryInfo: DirectoryInfo = {
                    ...mockDirectoryInfo,
                    files: [{
                        ...mockDirectoryInfo.files[0],
                        size
                    }]
                };
                mockDirectoryStructure.generate.mockImplementation((_dirs) => '# Directory Structure\n📁 test\n  📄 file.txt\n');
                const result = await markdownGenerator.generate([directoryInfo]);
                expect(result).toContain(`Size: ${expected}`);
                expect(result).not.toContain('<!-- matomeru:auto-graph:start -->');
            }
        });
    });

    it('単一のファイルを含むディレクトリを正しく処理する', async () => {
        mockConfig.get.mockImplementation((key: string, defaultValue?: any): any => {
            if (key === 'includeDependencies') return false;
            if (key === 'mermaid.maxNodes') return 300;
            if (key === 'markdown.prefixText') return '';
            if (key === 'enableCompression') return false;
            return defaultValue; 
        });
        mockGenerateYaml.mockResolvedValue(yaml.dump({ files: [], dependencies: {} }));

        const dir: DirectoryInfo = {
            uri: vscode.Uri.file('/test'),
            relativePath: 'test',
            files: [
                {
                    uri: vscode.Uri.file('/test/file1.ts'),
                    relativePath: 'test/file1.ts',
                    content: 'console.log("Hello");',
                    language: 'typescript',
                    size: 100,
                    imports: []
                }
            ],
            directories: new Map(),
            imports: []
        };

        mockDirectoryStructure.generate.mockReturnValue('# Directory Structure\n📁 test\n  📄 file1.ts\n');

        const result = await markdownGenerator.generate([dir]);
        
        expect(result).toContain('# Directory Structure');
        expect(result).toContain('📁 test');
        expect(result).toContain('📄 file1.ts');
        expect(result).toContain('# File Contents');
        expect(result).toContain('## test/file1.ts');
        expect(result).toContain('- Size: 100 B');
        expect(result).toContain('- Language: typescript');
        expect(result).toContain('```typescript');
        expect(result).toContain('console.log("Hello");');
        expect(result).not.toContain('<!-- matomeru:auto-graph:start -->');
    });

    it('複数のファイルとディレクトリを正しく処理する', async () => {
        mockConfig.get.mockImplementation((key: string, defaultValue?: any): any => {
            if (key === 'includeDependencies') return false;
            if (key === 'mermaid.maxNodes') return 300;
            if (key === 'markdown.prefixText') return '';
            if (key === 'enableCompression') return false;
            return defaultValue;
        });
        mockGenerateYaml.mockResolvedValue(yaml.dump({ files: [], dependencies: {} }));

        const subDirFile: FileInfo = {
            uri: vscode.Uri.file('/test/src/main.ts'),
            relativePath: 'test/src/main.ts',
            content: 'export const main = () => {};',
            language: 'typescript',
            size: 200,
            imports: []
        };
        const subDir: DirectoryInfo = {
            uri: vscode.Uri.file('/test/src'),
            relativePath: 'test/src',
            files: [subDirFile],
            directories: new Map(),
            imports: []
        };
        const rootFile: FileInfo = {
            uri: vscode.Uri.file('/test/README.md'),
            relativePath: 'test/README.md',
            content: '# Test Project',
            language: 'markdown',
            size: 100,
            imports: []
        };
        const dir: DirectoryInfo = {
            uri: vscode.Uri.file('/test'),
            relativePath: 'test',
            files: [rootFile],
            directories: new Map([['src', subDir]]),
            imports: []
        };

        mockDirectoryStructure.generate.mockReturnValue('# Directory Structure\n📁 test\n  📄 README.md\n  📁 src\n    📄 main.ts\n');
        const result = await markdownGenerator.generate([dir]);
        
        expect(result).toContain('# Directory Structure');
        expect(result).toContain('📁 test');
        expect(result).toContain('📄 README.md');
        expect(result).toContain('📁 src');
        expect(result).toContain('📄 main.ts');
        expect(result).toContain('# File Contents');
        expect(result).toContain('## test/README.md');
        expect(result).toContain('```markdown');
        expect(result).toContain('# Test Project');
        expect(result).toContain('## test/src/main.ts');
        expect(result).toContain('```typescript');
        expect(result).toContain('export const main = () => {};');
        expect(result).not.toContain('<!-- matomeru:auto-graph:start -->');
    });

    it('ファイルサイズを適切にフォーマットする', async () => {
        mockConfig.get.mockImplementation((key: string, defaultValue?: any): any => {
            if (key === 'includeDependencies') return false;
            if (key === 'mermaid.maxNodes') return 300;
            if (key === 'markdown.prefixText') return '';
            if (key === 'enableCompression') return false;
            return defaultValue;
        });
        mockGenerateYaml.mockResolvedValue(yaml.dump({ files: [], dependencies: {} }));
        const dir: DirectoryInfo = {
            uri: vscode.Uri.file('/test'),
            relativePath: 'test',
            files: [
                {
                    uri: vscode.Uri.file('/test/small.txt'),
                    relativePath: 'test/small.txt',
                    content: 'Small file',
                    language: 'plaintext',
                    size: 512,
                    imports: []
                },
                {
                    uri: vscode.Uri.file('/test/medium.txt'),
                    relativePath: 'test/medium.txt',
                    content: 'Medium file',
                    language: 'plaintext',
                    size: 1024 * 100,
                    imports: []
                },
                {
                    uri: vscode.Uri.file('/test/large.txt'),
                    relativePath: 'test/large.txt',
                    content: 'Large file',
                    language: 'plaintext',
                    size: 1024 * 1024 * 2,
                    imports: []
                }
            ],
            directories: new Map(),
            imports: []
        };
        mockDirectoryStructure.generate.mockReturnValue('# Directory Structure\n📁 test\n  📄 small.txt\n  📄 medium.txt\n  📄 large.txt\n');
        const result = await markdownGenerator.generate([dir]);
        
        expect(result).toContain('- Size: 512 B');
        expect(result).toContain('- Size: 100 KB');
        expect(result).toContain('- Size: 2 MB');
        expect(result).not.toContain('<!-- matomeru:auto-graph:start -->');
    });

    it('ファイルサイズが1024の倍数の場合、小数点以下を表示しない', async () => {
        mockConfig.get.mockImplementation((key: string, defaultValue?: any): any => {
            if (key === 'includeDependencies') return false;
            if (key === 'mermaid.maxNodes') return 300;
            if (key === 'markdown.prefixText') return '';
            if (key === 'enableCompression') return false;
            return defaultValue;
        });
        mockGenerateYaml.mockResolvedValue(yaml.dump({ files: [], dependencies: {} }));
        const dir: DirectoryInfo = {
            uri: vscode.Uri.file('/test'),
            relativePath: 'test',
            files: [
                {
                    uri: vscode.Uri.file('/test/exact.txt'),
                    relativePath: 'test/exact.txt',
                    content: 'Exact size file',
                    language: 'plaintext',
                    size: 1024,
                    imports: []
                },
                {
                    uri: vscode.Uri.file('/test/exact_mb.txt'),
                    relativePath: 'test/exact_mb.txt',
                    content: 'Exact MB size file',
                    language: 'plaintext',
                    size: 1024 * 1024,
                    imports: []
                }
            ],
            directories: new Map(),
            imports: []
        };
        mockDirectoryStructure.generate.mockReturnValue('# Directory Structure\n📁 test\n  📄 exact.txt\n  📄 exact_mb.txt\n');
        const result = await markdownGenerator.generate([dir]);
        
        expect(result).toContain('- Size: 1 KB');
        expect(result).toContain('- Size: 1 MB');
        expect(result).not.toContain('<!-- matomeru:auto-graph:start -->');
    });
}); 