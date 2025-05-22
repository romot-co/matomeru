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
            if (key === 'prefixText') return '';
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
                    if (key === 'prefixText') return '';
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
                    if (key === 'prefixText') return prefixText;
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
                    if (key === 'prefixText') return '';
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
                    if (key === 'prefixText') return prefixText;
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
                    if (key === 'prefixText') return '';
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

            test('依存データが空の場合、Mermaidグラフは生成されないこと', async () => {
                mockConfig.get.mockImplementation((key: string, defaultValue?: any): any => {
                    if (key === 'includeDependencies') return true;
                    if (key === 'mermaid.maxNodes') return 300;
                    if (key === 'prefixText') return '';
                    if (key === 'enableCompression') return false;
                    return defaultValue;
                });

                // YamlGeneratorが空のdependenciesを返すようにモックを設定
                mockGenerateYaml.mockImplementation((_directoriesInfo: DirectoryInfo[], _options: ScanOptions): string => {
                    const data = {
                        files: [ // filesはダミーデータでも良いが、構造は維持
                            { relativePath: 'test/path/app.ts', imports: [] },
                            { relativePath: 'test/path/utils.ts', imports: [] }
                        ],
                        dependencies: {} // ここを空にする
                    };
                    return yaml.dump(data);
                });

                const result = await markdownGenerator.generate([dirWithImports]); // dirWithImports は既存のテストデータを利用

                // Mermaidグラフの開始・終了コメントが含まれないことを確認
                expect(result).not.toContain('<!-- matomeru:auto-graph:start -->');
                expect(result).not.toContain('flowchart TD');
                expect(result).not.toContain('<!-- matomeru:auto-graph:end -->');

                // 通常のファイルコンテンツは含まれることを確認
                expect(result).toContain('# Directory Structure');
                expect(result).toContain('# File Contents');
                expect(result).toContain('## test/path/app.ts'); // dirWithImportsのファイル
            });

            test('一部のファイルのみ依存関係を持つ場合、正しくグラフが生成されること', async () => {
                mockConfig.get.mockImplementation((key: string, defaultValue?: any): any => {
                    if (key === 'includeDependencies') return true;
                    if (key === 'mermaid.maxNodes') return 300;
                    if (key === 'prefixText') return '';
                    if (key === 'enableCompression') return false;
                    return defaultValue;
                });

                mockGenerateYaml.mockImplementation((_directoriesInfo: DirectoryInfo[], _options: ScanOptions): string => {
                    const data = {
                        files: [
                            { relativePath: 'test/app.js', imports: ['external:moment', './utils.js'] },
                            { relativePath: 'test/utils.js', imports: [] }, // utils.js は依存なし
                            { relativePath: 'test/another.js', imports: [] } // another.js も依存なし
                        ],
                        dependencies: {
                            'test/app.js': ['external:moment', 'test/utils.js'],
                            // 'test/utils.js': [] // dependencies には空の配列は含めないことが多い
                            // 'test/another.js': []
                        }
                    };
                    return yaml.dump(data);
                });

                const dirWithPartialDeps: DirectoryInfo = {
                    ...mockDirectoryInfo, // 基本構造は既存のものを流用
                    files: [
                        { ...mockFile, relativePath: 'test/app.js', imports: ['external:moment', './utils.js'] },
                        { ...mockFile, relativePath: 'test/utils.js', content: '// Utility functions', imports: [] },
                        { ...mockFile, relativePath: 'test/another.js', content: '// Another file', imports: [] }
                    ]
                };

                const result = await markdownGenerator.generate([dirWithPartialDeps]);

                expect(result).toContain('<!-- matomeru:auto-graph:start -->');
                expect(result).toContain('flowchart TD');
                expect(result).toContain('    "test/app.js" --> "external:moment"');
                expect(result).toContain('    "test/app.js" --> "test/utils.js"');
                // utils.js や another.js からの依存がないため、それらを起点とするエッジは存在しない
                expect(result).not.toContain('"test/utils.js" -->');
                expect(result).not.toContain('"test/another.js" -->');
                expect(result).toContain('<!-- matomeru:auto-graph:end -->');

                expect(result).toContain('## test/app.js');
                expect(result).toContain('## test/utils.js');
                expect(result).toContain('## test/another.js');
            });

            test('ファイルパスに引用符が含まれている場合、エスケープされてMermaidグラフに含まれる', async () => {
                mockConfig.get.mockImplementation((key: string, defaultValue?: any): any => {
                    if (key === 'includeDependencies') return true;
                    if (key === 'mermaid.maxNodes') return 300;
                    if (key === 'prefixText') return '';
                    if (key === 'enableCompression') return false;
                    return defaultValue;
                });

                mockGenerateYaml.mockImplementation((_directoriesInfo: DirectoryInfo[], _options: ScanOptions): string => {
                    const data = {
                        files: [
                            { relativePath: 'test/"weird".ts', imports: ['./utils.ts'] },
                            { relativePath: 'test/utils.ts', imports: [] }
                        ],
                        dependencies: {
                            'test/"weird".ts': ['test/utils.ts'],
                            'test/utils.ts': []
                        }
                    };
                    return yaml.dump(data);
                });

                const dirWithQuote: DirectoryInfo = {
                    ...mockDirectoryInfo,
                    files: [
                        { ...mockFile, relativePath: 'test/"weird".ts', imports: ['./utils.ts'] },
                        { ...mockFile, relativePath: 'test/utils.ts', imports: [] }
                    ]
                };

                const result = await markdownGenerator.generate([dirWithQuote]);

                expect(result).toContain('<!-- matomeru:auto-graph:start -->');
                expect(result).toContain('flowchart TD');
                expect(result).toContain('    "test/\\"weird\\".ts" --> "test/utils.ts"');
                expect(result).toContain('<!-- matomeru:auto-graph:end -->');
            });

            describe('maxNodes制限のテスト', () => {
                const baseDirWithImports: DirectoryInfo = { // このテストスイート内で共通で使えるデータ
                    ...mockDirectoryInfo,
                    files: [
                        { ...mockFile, relativePath: 'test/a.js', imports: ['./b.js', './c.js'] }, // a -> b, a -> c (3 nodes, 2 edges initially)
                        { ...mockFile, relativePath: 'test/b.js', imports: ['./d.js'] },             // b -> d (d is new, 4 nodes, 3 edges)
                        { ...mockFile, relativePath: 'test/c.js', imports: ['./d.js', './e.js'] },   // c -> d, c -> e (e is new, 5 nodes, 5 edges)
                        { ...mockFile, relativePath: 'test/d.js', imports: [] },
                        { ...mockFile, relativePath: 'test/e.js', imports: ['./a.js'] }              // e -> a (cycle, 5 nodes, 6 edges)
                    ]
                };
                const correspondingDependencies = {
                    'test/a.js': ['test/b.js', 'test/c.js'],
                    'test/b.js': ['test/d.js'],
                    'test/c.js': ['test/d.js', 'test/e.js'],
                    'test/e.js': ['test/a.js'] 
                    // d.js は依存先がないので省略
                }; // 5 nodes (a,b,c,d,e), 6 edges

                beforeEach(() => { // このdescribeブロックの各テストの前に共通のモック設定
                    mockConfig.get.mockImplementation((key: string, defaultValue?: any): any => {
                        if (key === 'includeDependencies') return true;
                        // maxNodes は各テストケースで上書きする
                        if (key === 'prefixText') return '';
                        if (key === 'enableCompression') return false;
                        return defaultValue;
                    });
                    mockGenerateYaml.mockImplementation((_directoriesInfo: DirectoryInfo[], _options: ScanOptions): string => {
                        const data = {
                            files: baseDirWithImports.files.map(f => ({ relativePath: f.relativePath, imports: f.imports })),
                            dependencies: correspondingDependencies
                        };
                        return yaml.dump(data);
                    });
                });

                test('ノード数がmaxNodesと一致する場合、グラフは完全に表示される', async () => {
                    mockConfig.get.mockImplementation((key: string, defaultValue?: any): any => {
                        if (key === 'includeDependencies') return true;
                        if (key === 'mermaid.maxNodes') return 5; // ノード数と一致
                        if (key === 'prefixText') return '';
                        if (key === 'enableCompression') return false;
                        return defaultValue;
                    });
                    const result = await markdownGenerator.generate([baseDirWithImports]);
                    expect(result).toContain('flowchart TD');
                    expect(result).toContain('"test/a.js"'); // ノードの存在確認
                    expect(result).toContain('"test/e.js"');
                    expect(result).toContain('    "test/e.js" --> "test/a.js"'); // エッジの存在確認
                    expect(result).not.toMatch(/Warning: Mermaid graph truncated/i);
                });

                test('ノード数がmaxNodesを1つ超える場合 (既存のmaxNodes:1テストケースと同様の趣旨)', async () => {
                    mockConfig.get.mockImplementation((key: string, defaultValue?: any): any => {
                        if (key === 'includeDependencies') return true;
                        if (key === 'mermaid.maxNodes') return 4; // ノード数5に対して4
                        if (key === 'prefixText') return '';
                        if (key === 'enableCompression') return false;
                        return defaultValue;
                    });
                    const result = await markdownGenerator.generate([baseDirWithImports]);
                    expect(result).toMatch(/Warning: Mermaid graph truncated/i);
                    expect(result).toMatch(/exceeds the configured limit \(4\)/i);
                     // グラフの内容自体もある程度は描画されることを確認（省略の仕方による）
                    expect(result).toContain('flowchart TD');
                });
                
                test('ノード数がmaxNodesを大幅に超える場合、グラフは省略され警告が表示される', async () => {
                    mockConfig.get.mockImplementation((key: string, defaultValue?: any): any => {
                        if (key === 'includeDependencies') return true;
                        if (key === 'mermaid.maxNodes') return 2; // ノード数5に対して2
                        if (key === 'prefixText') return '';
                        if (key === 'enableCompression') return false;
                        return defaultValue;
                    });
                    const result = await markdownGenerator.generate([baseDirWithImports]);
                    expect(result).toMatch(/Warning: Mermaid graph truncated/i);
                    expect(result).toMatch(/exceeds the configured limit \(2\)/i);
                    expect(result).toContain('flowchart TD'); // subgraph Warning も flowchart TD の一部
                });

                // 元のmaxNodesテストケースも残すか、この新しいスイートに統合するか検討できます。
                // ここでは新しいテストスイートとして分離しました。
            });

            test('実際のJSファイル間の依存関係を模したケースでグラフが正しく生成される', async () => {
                mockConfig.get.mockImplementation((key: string, defaultValue?: any): any => {
                    if (key === 'includeDependencies') return true;
                    if (key === 'mermaid.maxNodes') return 300;
                    if (key === 'prefixText') return '';
                    if (key === 'enableCompression') return false;
                    return defaultValue;
                });

                // scanDependenciesが返すであろうデータ構造をYamlGeneratorのモックで再現
                mockGenerateYaml.mockImplementation((_directoriesInfo: DirectoryInfo[], _options: ScanOptions): string => {
                    const data = {
                        files: [ // FileInfo.imports を模倣
                            { relativePath: 'src/app.js', imports: ['external:moment', './utils.js'], content: 'import moment from "moment";\nimport { helper } from "./utils.js";' },
                            { relativePath: 'src/utils.js', imports: [], content: 'export const helper = () => {};' }
                        ],
                        dependencies: { // 上記 imports に基づく依存関係
                            'src/app.js': ['external:moment', 'src/utils.js']
                            // 'src/utils.js': [] // 依存がない場合はキー自体がないことが多い
                        }
                    };
                    return yaml.dump(data);
                });
                
                // MarkdownGeneratorに渡すDirectoryInfoデータ。ここでのFileInfo.importsは実際には使われないが、構造として渡す。
                const jsDir: DirectoryInfo = {
                    uri: { fsPath: '/project/src' } as vscode.Uri,
                    relativePath: 'src',
                    files: [
                        { 
                            uri: { fsPath: '/project/src/app.js' } as vscode.Uri,
                            relativePath: 'src/app.js', 
                            content: 'import moment from "moment";\nimport { helper } from "./utils.js";', 
                            language: 'javascript', 
                            size: 100,
                            imports: ['external:moment', './utils.js'] // scanDependenciesが設定するであろう値
                        },
                        { 
                            uri: { fsPath: '/project/src/utils.js' } as vscode.Uri,
                            relativePath: 'src/utils.js', 
                            content: 'export const helper = () => {};', 
                            language: 'javascript', 
                            size: 50,
                            imports: [] // scanDependenciesが設定するであろう値
                        }
                    ],
                    directories: new Map()
                };

                const result = await markdownGenerator.generate([jsDir]);

                expect(result).toContain('<!-- matomeru:auto-graph:start -->');
                expect(result).toContain('flowchart TD');
                expect(result).toContain('    "src/app.js" --> "external:moment"');
                expect(result).toContain('    "src/app.js" --> "src/utils.js"');
                expect(result).not.toContain('"src/utils.js" -->'); // utils.jsからの依存はない
                expect(result).toContain('<!-- matomeru:auto-graph:end -->');

                // ファイル内容の表示も確認
                expect(result).toContain('## src/app.js');
                expect(result).toContain('import moment from "moment";');
                expect(result).toContain('## src/utils.js');
                expect(result).toContain('export const helper = () => {};');
            });

            test('循環依存がある場合、警告コメントが追加される', async () => {
                mockConfig.get.mockImplementation((key: string, defaultValue?: any): any => {
                    if (key === 'includeDependencies') return true;
                    if (key === 'mermaid.maxNodes') return 300;
                    if (key === 'prefixText') return '';
                    if (key === 'enableCompression') return false;
                    return defaultValue;
                });

                mockGenerateYaml.mockImplementation((_directoriesInfo: DirectoryInfo[], _options: ScanOptions): string => {
                    const data = {
                        files: [
                            { relativePath: 'test/a.ts', imports: ['./b.ts'] },
                            { relativePath: 'test/b.ts', imports: ['./c.ts'] },
                            { relativePath: 'test/c.ts', imports: ['./a.ts'] }
                        ],
                        dependencies: {
                            'test/a.ts': ['test/b.ts'],
                            'test/b.ts': ['test/c.ts'],
                            'test/c.ts': ['test/a.ts']
                        }
                    };
                    return yaml.dump(data);
                });

                const dirWithCycle: DirectoryInfo = {
                    ...mockDirectoryInfo,
                    files: [
                        { ...mockFile, relativePath: 'test/a.ts', imports: ['./b.ts'] },
                        { ...mockFile, relativePath: 'test/b.ts', imports: ['./c.ts'] },
                        { ...mockFile, relativePath: 'test/c.ts', imports: ['./a.ts'] }
                    ]
                };

                const result = await markdownGenerator.generate([dirWithCycle]);

                expect(result).toContain('flowchart TD');
                expect(result).toMatch(/%% Warning: Circular dependencies detected/);
            });
        });

        test('ファイルサイズが適切にフォーマットされること', async () => {
            mockConfig.get.mockImplementation((key: string, defaultValue?: any): any => {
                if (key === 'includeDependencies') return false;
                if (key === 'mermaid.maxNodes') return 300;
                if (key === 'prefixText') return '';
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
            if (key === 'prefixText') return '';
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
            if (key === 'prefixText') return '';
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
            if (key === 'prefixText') return '';
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
            if (key === 'prefixText') return '';
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