import * as vscode from 'vscode';
import { DirectoryStructure } from '../directoryStructure';
import { DirectoryInfo } from '../types/fileTypes';

describe('DirectoryStructure', () => {
    let directoryStructure: DirectoryStructure;

    beforeEach(() => {
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
}); 