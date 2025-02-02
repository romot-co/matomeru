import * as vscode from 'vscode';
import { DirectoryStructure } from '../directoryStructure';
import { DirectoryInfo } from '../types/fileTypes';
import { ConfigService } from '../services/configService';

jest.mock('../services/configService');

describe('DirectoryStructure', () => {
    let directoryStructure: DirectoryStructure;

    beforeEach(() => {
        jest.resetAllMocks();
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

    it('空のディレクトリリストに対して空文字列を返す', () => {
        const result = directoryStructure.generate([]);
        expect(result).toBe('');
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
}); 