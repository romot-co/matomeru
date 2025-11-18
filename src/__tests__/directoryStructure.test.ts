import * as vscode from 'vscode';
import { DirectoryStructure } from '../directoryStructure';
import { DirectoryInfo, FileInfo } from '../types/fileTypes';
import { ConfigService } from '../services/configService';
import { describe, expect, beforeEach, jest } from '@jest/globals';

// VSCode APIのモック
jest.mock('vscode', () => ({
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path }))
  },
  workspace: {}
}));

const workspaceFolderMock = jest.fn();
(vscode.workspace as any).getWorkspaceFolder = workspaceFolderMock;


// ConfigServiceのモック
jest.mock('../services/configService', () => ({
  ConfigService: {
    getInstance: jest.fn(() => ({
      getConfig: jest.fn(() => ({
        directoryStructure: {
          directoryIcon: '📁',
          fileIcon: '📄',
          indentSize: 2,
          showFileExtensions: true,
          useEmoji: true
        }
      }))
    }))
  }
}));

describe('DirectoryStructure', () => {
    let directoryStructure: DirectoryStructure;

    beforeEach(() => {
        jest.clearAllMocks();
        workspaceFolderMock.mockReset();
        workspaceFolderMock.mockImplementation(() => ({
            name: 'DefaultWorkspace',
            uri: { fsPath: '/workspace' }
        }));
        // ConfigServiceのモックを設定
        (ConfigService.getInstance as jest.Mock).mockReturnValue({
            getConfig: jest.fn().mockReturnValue({
                directoryStructure: {
                    useEmoji: true,
                    directoryIcon: '📁',
                    fileIcon: '📄',
                    indentSize: 2,
                    showFileExtensions: true
                }
            })
        });
        directoryStructure = new DirectoryStructure();
    });

    const createFileInfo = (relativePath: string): FileInfo => ({
        uri: vscode.Uri.file(`/workspace/${relativePath}`),
        relativePath,
        content: `// Content of ${relativePath}`,
        language: 'typescript',
        size: 100
    });

    const createDirectoryInfo = (
        relativePath: string, 
        files: FileInfo[] = [], 
        subdirs: Map<string, DirectoryInfo> = new Map()
    ): DirectoryInfo => ({
        uri: vscode.Uri.file(`/workspace/${relativePath}`),
        relativePath,
        files,
        directories: subdirs
    });

    describe('ディレクトリマージ機能', () => {
        it('2つの異なるディレクトリを正しくマージすること', () => {
            const dir1 = createDirectoryInfo('src', [createFileInfo('src/app.ts')]);
            const dir2 = createDirectoryInfo('tests', [createFileInfo('tests/app.test.ts')]);
            
            const result = directoryStructure.generate([dir1, dir2]);
            
            expect(result).toContain('📁 .');
            expect(result).toContain('📄 app.ts');
            expect(result).toContain('📄 app.test.ts');
        });

        it('同じディレクトリ内でファイルが重複しないこと', () => {
            const file1 = createFileInfo('src/utils.ts');
            const file2 = createFileInfo('src/utils.ts'); // 同じファイル
            
            const dir1 = createDirectoryInfo('src', [file1]);
            const dir2 = createDirectoryInfo('src', [file2]);
            
            const result = directoryStructure.generate([dir1, dir2]);
            
            // utils.tsが1回だけ出現することを確認
            const utilsMatches = result.match(/utils\.ts/g);
            expect(utilsMatches).toHaveLength(1);
        });

        it('ネストしたディレクトリを正しくマージすること', () => {
            const nestedSubdir = new Map<string, DirectoryInfo>();
            nestedSubdir.set('nested', createDirectoryInfo('src/utils/nested', [
                createFileInfo('src/utils/nested/deep.ts')
            ]));
            
            const utilsSubdir = new Map<string, DirectoryInfo>();
            utilsSubdir.set('utils', createDirectoryInfo('src/utils', [
                createFileInfo('src/utils/helper.ts')
            ], nestedSubdir));
            
            const dir1 = createDirectoryInfo('src', [createFileInfo('src/index.ts')], utilsSubdir);
            const dir2 = createDirectoryInfo('src', [createFileInfo('src/main.ts')]);
            
            const result = directoryStructure.generate([dir1, dir2]);
            
            expect(result).toContain('📄 index.ts');
            expect(result).toContain('📄 main.ts');
            expect(result).toContain('📄 helper.ts');
            expect(result).toContain('📄 deep.ts');
        });

        it('異なる深度のディレクトリパスを正しく処理すること', () => {
            const dir1 = createDirectoryInfo('', [createFileInfo('root.ts')]);
            const dir2 = createDirectoryInfo('src/components', [createFileInfo('src/components/Button.tsx')]);
            
            const result = directoryStructure.generate([dir1, dir2]);
            
            expect(result).toContain('📄 root.ts');
            expect(result).toContain('📄 Button.tsx');
            expect(result).toContain('📁 src');
            expect(result).toContain('📁 components');
        });
    });

    describe('ファイル表示オプション', () => {
        it('ファイル拡張子を表示すること（デフォルト）', () => {
            const dir = createDirectoryInfo('src', [createFileInfo('src/app.ts')]);
            
            const result = directoryStructure.generate([dir]);
            
            expect(result).toContain('📄 app.ts');
        });

        it('アルファベット順でファイルをソートすること', () => {
            const files = [
                createFileInfo('src/zebra.ts'),
                createFileInfo('src/alpha.ts'),
                createFileInfo('src/beta.ts')
            ];
            const dir = createDirectoryInfo('src', files);
            
            const result = directoryStructure.generate([dir]);
            
            const lines = result.split('\n');
            const alphaIndex = lines.findIndex(line => line.includes('alpha.ts'));
            const betaIndex = lines.findIndex(line => line.includes('beta.ts'));
            const zebraIndex = lines.findIndex(line => line.includes('zebra.ts'));
            
            expect(alphaIndex).toBeLessThan(betaIndex);
            expect(betaIndex).toBeLessThan(zebraIndex);
        });

        it('ディレクトリもアルファベット順でソートすること', () => {
            const subDirs = new Map<string, DirectoryInfo>();
            subDirs.set('zebra', createDirectoryInfo('zebra'));
            subDirs.set('alpha', createDirectoryInfo('alpha'));
            subDirs.set('beta', createDirectoryInfo('beta'));
            
            const dir = createDirectoryInfo('', [], subDirs);
            
            const result = directoryStructure.generate([dir]);
            
            const lines = result.split('\n');
            const alphaIndex = lines.findIndex(line => line.includes('📁 alpha'));
            const betaIndex = lines.findIndex(line => line.includes('📁 beta'));
            const zebraIndex = lines.findIndex(line => line.includes('📁 zebra'));
            
            expect(alphaIndex).toBeLessThan(betaIndex);
            expect(betaIndex).toBeLessThan(zebraIndex);
        });
    });

    it('単一のディレクトリを正しく表示する', () => {
        const dir: DirectoryInfo = {
            uri: vscode.Uri.file('/test'),
            relativePath: 'test',
            files: [
                {
                    uri: vscode.Uri.file('/test/file1.txt'),
                    relativePath: 'test/file1.txt',
                    content: 'content',
                    language: 'plaintext',
                    size: 100
                }
            ],
            directories: new Map()
        };

        const result = directoryStructure.generate([dir]);
        
        expect(result).toContain('# Directory Structure');
        expect(result).toContain('📁 test');
        expect(result).toContain('📄 file1.txt');
    });

    it('ネストされたディレクトリ構造を正しく表示する', () => {
        const subDir: DirectoryInfo = {
            uri: vscode.Uri.file('/test/subdir'),
            relativePath: 'test/subdir',
            files: [
                {
                    uri: vscode.Uri.file('/test/subdir/file2.txt'),
                    relativePath: 'test/subdir/file2.txt',
                    content: 'content',
                    language: 'plaintext',
                    size: 100
                }
            ],
            directories: new Map()
        };

        const dir: DirectoryInfo = {
            uri: vscode.Uri.file('/test'),
            relativePath: 'test',
            files: [
                {
                    uri: vscode.Uri.file('/test/file1.txt'),
                    relativePath: 'test/file1.txt',
                    content: 'content',
                    language: 'plaintext',
                    size: 100
                }
            ],
            directories: new Map([['subdir', subDir]])
        };

        const result = directoryStructure.generate([dir]);
        
        expect(result).toContain('📁 test');
        expect(result).toContain('📄 file1.txt');
        expect(result).toContain('📁 subdir');
        expect(result).toContain('📄 file2.txt');
    });

    it('複数のディレクトリをアルファベット順に表示する', () => {
        const dir1: DirectoryInfo = {
            uri: vscode.Uri.file('/test1'),
            relativePath: 'test1',
            files: [],
            directories: new Map()
        };

        const dir2: DirectoryInfo = {
            uri: vscode.Uri.file('/test2'),
            relativePath: 'test2',
            files: [],
            directories: new Map()
        };

        const result = directoryStructure.generate([dir2, dir1]);
        const lines = result.split('\n');
        
        const dir1Index = lines.findIndex(line => line.includes('test1'));
        const dir2Index = lines.findIndex(line => line.includes('test2'));
        
        expect(dir1Index).toBeLessThan(dir2Index);
    });

    it('ルートディレクトリのパスが空の場合でも正しく処理する', () => {
        const dir: DirectoryInfo = {
            uri: vscode.Uri.file('/'),
            relativePath: '',
            files: [
                {
                    uri: vscode.Uri.file('/test.txt'),
                    relativePath: 'test.txt',
                    content: 'content',
                    language: 'plaintext',
                    size: 100
                }
            ],
            directories: new Map()
        };

        const result = directoryStructure.generate([dir]);
        expect(result).toContain('📁 .');
        expect(result).toContain('📄 test.txt');
    });

    it('ファイル拡張子を非表示にする設定の場合、拡張子なしでファイル名を表示する', () => {
        // ConfigServiceのモックを更新
        (ConfigService.getInstance as jest.Mock).mockReturnValue({
            getConfig: jest.fn().mockReturnValue({
                directoryStructure: {
                    useEmoji: true,
                    directoryIcon: '📁',
                    fileIcon: '📄',
                    indentSize: 2,
                    showFileExtensions: false
                }
            })
        });
        directoryStructure = new DirectoryStructure();

        const dir: DirectoryInfo = {
            uri: vscode.Uri.file('/test'),
            relativePath: 'test',
            files: [
                {
                    uri: vscode.Uri.file('/test/file1.txt'),
                    relativePath: 'test/file1.txt',
                    content: 'content',
                    language: 'plaintext',
                    size: 100
                }
            ],
            directories: new Map()
        };

        const result = directoryStructure.generate([dir]);
        expect(result).toContain('📄 file1');
        expect(result).not.toContain('📄 file1.txt');
    });

    it('拡張子のないファイル名を正しく処理する', () => {
        const dir: DirectoryInfo = {
            uri: vscode.Uri.file('/test'),
            relativePath: 'test',
            files: [
                {
                    uri: vscode.Uri.file('/test/README'),
                    relativePath: 'test/README',
                    content: 'content',
                    language: 'plaintext',
                    size: 100
                }
            ],
            directories: new Map()
        };

        const result = directoryStructure.generate([dir]);
        expect(result).toContain('📄 README');
    });

    it('空のファイル名を正しく処理する', () => {
        const dir: DirectoryInfo = {
            uri: vscode.Uri.file('/test'),
            relativePath: 'test',
            files: [
                {
                    uri: vscode.Uri.file('/test/'),
                    relativePath: 'test/',
                    content: 'content',
                    language: 'plaintext',
                    size: 100
                }
            ],
            directories: new Map()
        };

        const result = directoryStructure.generate([dir]);
        expect(result).toContain('📄 ');
    });

    it('絵文字を使用しない設定の場合、アイコンなしで表示する', () => {
        // ConfigServiceのモックを更新
        (ConfigService.getInstance as jest.Mock).mockReturnValue({
            getConfig: jest.fn().mockReturnValue({
                directoryStructure: {
                    useEmoji: false,
                    directoryIcon: '📁',
                    fileIcon: '📄',
                    indentSize: 2,
                    showFileExtensions: true
                }
            })
        });
        directoryStructure = new DirectoryStructure();

        const dir: DirectoryInfo = {
            uri: vscode.Uri.file('/test'),
            relativePath: 'test',
            files: [
                {
                    uri: vscode.Uri.file('/test/file1.txt'),
                    relativePath: 'test/file1.txt',
                    content: 'content',
                    language: 'plaintext',
                    size: 100
                }
            ],
            directories: new Map()
        };

        const result = directoryStructure.generate([dir]);
        expect(result).not.toContain('📁');
        expect(result).not.toContain('📄');
        expect(result).toContain(' test');
        expect(result).toContain('  file1.txt');
    });

    it('サブディレクトリをアルファベット順に表示する', () => {
        const subDir1: DirectoryInfo = {
            uri: vscode.Uri.file('/test/b'),
            relativePath: 'test/b',
            files: [],
            directories: new Map()
        };

        const subDir2: DirectoryInfo = {
            uri: vscode.Uri.file('/test/a'),
            relativePath: 'test/a',
            files: [],
            directories: new Map()
        };

        const dir: DirectoryInfo = {
            uri: vscode.Uri.file('/test'),
            relativePath: 'test',
            files: [],
            directories: new Map([
                ['b', subDir1],
                ['a', subDir2]
            ])
        };

        const result = directoryStructure.generate([dir]);
        const lines = result.split('\n');
        
        const subDir1Index = lines.findIndex(line => line.includes('b'));
        const subDir2Index = lines.findIndex(line => line.includes('a'));
        
        expect(subDir2Index).toBeLessThan(subDir1Index);
    });

    it('ファイル名にドットが含まれない場合も正しく処理する', () => {
        // ConfigServiceのモックを更新
        (ConfigService.getInstance as jest.Mock).mockReturnValue({
            getConfig: jest.fn().mockReturnValue({
                directoryStructure: {
                    useEmoji: true,
                    directoryIcon: '📁',
                    fileIcon: '📄',
                    indentSize: 2,
                    showFileExtensions: false
                }
            })
        });
        directoryStructure = new DirectoryStructure();

        const dir: DirectoryInfo = {
            uri: vscode.Uri.file('/test'),
            relativePath: 'test',
            files: [
                {
                    uri: vscode.Uri.file('/test/nodot'),
                    relativePath: 'test/nodot',
                    content: 'content',
                    language: 'plaintext',
                    size: 100
                }
            ],
            directories: new Map()
        };

        const result = directoryStructure.generate([dir]);
        expect(result).toContain('📄 nodot');
    });

    it('サブディレクトリのパスが空の場合も正しく処理する', () => {
        const subDir: DirectoryInfo = {
            uri: vscode.Uri.file('/test/'),
            relativePath: 'test/',
            files: [],
            directories: new Map()
        };

        const dir: DirectoryInfo = {
            uri: vscode.Uri.file('/test'),
            relativePath: 'test',
            files: [],
            directories: new Map([
                ['', subDir]
            ])
        };

        const result = directoryStructure.generate([dir]);
        expect(result).toContain('📁 test');
        expect(result).toContain('📁 ');
    });

    it('重複するトップレベルディレクトリが１件に統合されること', () => {
        const dir1: DirectoryInfo = {
            uri: vscode.Uri.file('/test'),
            relativePath: '',  // 空文字は '.' として扱う
            files: [{
                uri: vscode.Uri.file('/test/README.md'),
                relativePath: 'README.md',
                content: 'content1',
                language: 'markdown',
                size: 100
            }],
            directories: new Map()
        };
        const dir2: DirectoryInfo = {
            uri: vscode.Uri.file('/test'),
            relativePath: '',  // 空文字は '.' として扱う
            files: [{
                uri: vscode.Uri.file('/test/LICENSE'),
                relativePath: 'LICENSE',
                content: 'content2',
                language: 'plaintext',
                size: 200
            }],
            directories: new Map()
        };

        const result = directoryStructure.generate([dir1, dir2]);
        
        // 統合結果としてトップレベルが1件のみ
        const topDirCount = result.split('\n').filter(line => line.includes('📁')).length;
        expect(topDirCount).toBe(1);
        expect(result).toContain('📄 README.md');
        expect(result).toContain('📄 LICENSE');
    });

    it('重複するトップレベルディレクトリのサブディレクトリも正しく統合されること', () => {
        const subDir1: DirectoryInfo = {
            uri: vscode.Uri.file('/test/src'),
            relativePath: 'src',
            files: [{
                uri: vscode.Uri.file('/test/src/index.ts'),
                relativePath: 'src/index.ts',
                content: 'content1',
                language: 'typescript',
                size: 100
            }],
            directories: new Map()
        };

        const subDir2: DirectoryInfo = {
            uri: vscode.Uri.file('/test/docs'),
            relativePath: 'docs',
            files: [{
                uri: vscode.Uri.file('/test/docs/README.md'),
                relativePath: 'docs/README.md',
                content: 'content2',
                language: 'markdown',
                size: 200
            }],
            directories: new Map()
        };

        const dir1: DirectoryInfo = {
            uri: vscode.Uri.file('/test'),
            relativePath: '.',
            files: [{
                uri: vscode.Uri.file('/test/package.json'),
                relativePath: 'package.json',
                content: 'content3',
                language: 'json',
                size: 300
            }],
            directories: new Map([['src', subDir1]])
        };

        const dir2: DirectoryInfo = {
            uri: vscode.Uri.file('/test'),
            relativePath: '.',
            files: [{
                uri: vscode.Uri.file('/test/README.md'),
                relativePath: 'README.md',
                content: 'content4',
                language: 'markdown',
                size: 400
            }],
            directories: new Map([['docs', subDir2]])
        };

        const result = directoryStructure.generate([dir1, dir2]);
        
        // 統合結果としてトップレベルが1件のみ
        const topDirCount = result.split('\n').filter(line => line.match(/^📁/)).length;
        expect(topDirCount).toBe(1);

        // すべてのファイルとサブディレクトリが含まれていること
        expect(result).toContain('📄 package.json');
        expect(result).toContain('📄 README.md');
        expect(result).toContain('📁 src');
        expect(result).toContain('📄 index.ts');
        expect(result).toContain('📁 docs');
        expect(result).toContain('📄 README.md');

        // ディレクトリ構造が正しく維持されていること
        const lines = result.split('\n');
        const srcIndex = lines.findIndex(line => line.includes('📁 src'));
        const docsIndex = lines.findIndex(line => line.includes('📁 docs'));
        expect(srcIndex).not.toBe(-1);
        expect(docsIndex).not.toBe(-1);
        expect(lines[srcIndex + 1]).toContain('📄 index.ts');
        expect(lines[docsIndex + 1]).toContain('📄 README.md');
    });

    describe('エッジケース', () => {
        it('空のディレクトリリストを処理すること', () => {
            const result = directoryStructure.generate([]);
            
            expect(result).toBe('');
        });

        it('空のディレクトリを処理すること', () => {
            const dir = createDirectoryInfo('empty');
            
            const result = directoryStructure.generate([dir]);
            
            expect(result).toContain('📁 .');
            expect(result).toContain('📁 empty');
        });

        it('ルートディレクトリ（"."）を正しく処理すること', () => {
            const dir = createDirectoryInfo('.', [createFileInfo('README.md')]);
            
            const result = directoryStructure.generate([dir]);
            
            expect(result).toContain('📁 .');
            expect(result).toContain('📄 README.md');
        });

        it('複雑なディレクトリ構造を正しくインデントすること', () => {
            const deepNested = new Map<string, DirectoryInfo>();
            deepNested.set('level3', createDirectoryInfo('src/level1/level2/level3', [
                createFileInfo('src/level1/level2/level3/deep.ts')
            ]));
            
            const level2 = new Map<string, DirectoryInfo>();
            level2.set('level2', createDirectoryInfo('src/level1/level2', [], deepNested));
            
            const level1 = new Map<string, DirectoryInfo>();
            level1.set('level1', createDirectoryInfo('src/level1', [], level2));
            
            const dir = createDirectoryInfo('src', [], level1);
            
            const result = directoryStructure.generate([dir]);
            
            // インデントレベルをチェック
            const lines = result.split('\n');
            const srcLine = lines.find(line => line.includes('📁 src'));
            const level1Line = lines.find(line => line.includes('📁 level1'));
            const level2Line = lines.find(line => line.includes('📁 level2'));
            const level3Line = lines.find(line => line.includes('📁 level3'));
            const deepFile = lines.find(line => line.includes('📄 deep.ts'));
            
            expect(srcLine).toBeDefined();
            expect(level1Line).toBeDefined();
            expect(level2Line).toBeDefined();
            expect(level3Line).toBeDefined();
            expect(deepFile).toBeDefined();
            
            // インデントの深さを確認（各レベルで2スペースずつ増加）
            const getIndentLevel = (line: string) => {
                const match = line.match(/^(\s*)/);
                return match ? match[1].length : 0;
            };
            
            if (srcLine && level1Line && level2Line && level3Line && deepFile) {
                expect(getIndentLevel(level1Line)).toBeGreaterThan(getIndentLevel(srcLine!));
                expect(getIndentLevel(level2Line)).toBeGreaterThan(getIndentLevel(level1Line));
                expect(getIndentLevel(level3Line)).toBeGreaterThan(getIndentLevel(level2Line));
                expect(getIndentLevel(deepFile)).toBeGreaterThan(getIndentLevel(level3Line));
            }
        });

        it('特殊文字を含むファイル名を正しく処理すること', () => {
            const files = [
                createFileInfo('src/file with spaces.ts'),
                createFileInfo('src/file-with-dashes.js'),
                createFileInfo('src/file_with_underscores.py'),
                createFileInfo('src/file.with.dots.json')
            ];
            const dir = createDirectoryInfo('src', files);
            
            const result = directoryStructure.generate([dir]);
            
            expect(result).toContain('📄 file with spaces.ts');
            expect(result).toContain('📄 file-with-dashes.js');
            expect(result).toContain('📄 file_with_underscores.py');
            expect(result).toContain('📄 file.with.dots.json');
        });
    });

    describe('ディレクトリマージの詳細テスト', () => {
        it('複数のDirectoryInfoが同じ相対パスを持つ場合に正しくマージすること', () => {
            const file1 = createFileInfo('shared/utils.ts');
            const file2 = createFileInfo('shared/config.ts');
            
            const dir1 = createDirectoryInfo('shared', [file1]);
            const dir2 = createDirectoryInfo('shared', [file2]);
            
            const result = directoryStructure.generate([dir1, dir2]);
            
            expect(result).toContain('📄 utils.ts');
            expect(result).toContain('📄 config.ts');
            
            // ファイルが正しく含まれていることを確認
            expect(result).toContain('📄 utils.ts');
            expect(result).toContain('📄 config.ts');
        });

        it('サブディレクトリの競合を正しく解決すること', () => {
            const commonSubdir1 = new Map<string, DirectoryInfo>();
            commonSubdir1.set('common', createDirectoryInfo('src/common', [
                createFileInfo('src/common/types.ts')
            ]));
            
            const commonSubdir2 = new Map<string, DirectoryInfo>();
            commonSubdir2.set('common', createDirectoryInfo('src/common', [
                createFileInfo('src/common/utils.ts')
            ]));
            
            const dir1 = createDirectoryInfo('src', [createFileInfo('src/app.ts')], commonSubdir1);
            const dir2 = createDirectoryInfo('src', [createFileInfo('src/main.ts')], commonSubdir2);
            
            const result = directoryStructure.generate([dir1, dir2]);
            
            expect(result).toContain('📄 app.ts');
            expect(result).toContain('📄 main.ts');
            expect(result).toContain('📄 types.ts');
            expect(result).toContain('📄 utils.ts');
            expect(result).toContain('📁 common');
        });

        it('マルチルートでは各ワークスペースが独立したセクションになる', () => {
            workspaceFolderMock.mockImplementation((uri: any) => {
                if (uri.fsPath.startsWith('/wsA')) {
                    return { name: 'WorkspaceA', uri: { fsPath: '/wsA' } } as any;
                }
                if (uri.fsPath.startsWith('/wsB')) {
                    return { name: 'WorkspaceB', uri: { fsPath: '/wsB' } } as any;
                }
                return undefined;
            });

            const dirA = createDirectoryInfo('', [
                {
                    ...createFileInfo('appA.ts'),
                    uri: vscode.Uri.file('/wsA/appA.ts'),
                    relativePath: 'appA.ts'
                }
            ]);
            dirA.uri = vscode.Uri.file('/wsA');

            const dirB = createDirectoryInfo('', [
                {
                    ...createFileInfo('appB.ts'),
                    uri: vscode.Uri.file('/wsB/appB.ts'),
                    relativePath: 'appB.ts'
                }
            ]);
            dirB.uri = vscode.Uri.file('/wsB');

            const result = directoryStructure.generate([dirA, dirB]);

            expect(result).toContain('## WorkspaceA');
            expect(result).toContain('## WorkspaceB');
            const [workspaceASection] = result.split('## WorkspaceB');
            expect(workspaceASection).toContain('appA.ts');
            expect(workspaceASection).not.toContain('appB.ts');
        });

        it('ワークスペースが無い場合はパスベースのラベルを使う', () => {
            workspaceFolderMock.mockReturnValue(undefined);
            const dir = createDirectoryInfo('', [createFileInfo('standalone/file.ts')]);
            dir.uri = vscode.Uri.file('/standalone');

            const result = directoryStructure.generate([dir]);

            expect(result).toContain('# Directory Structure');
            expect(result).toContain('📁 .');
        });
    });
});
