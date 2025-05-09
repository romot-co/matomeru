import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { YamlGenerator } from '../generators/YamlGenerator';
import { DirectoryInfo, FileInfo } from '../types/fileTypes'; // Test data structure
import yaml from 'js-yaml';

jest.mock('vscode');

describe('YamlGenerator', () => {
    let yamlGenerator: YamlGenerator;
    let mockConfig: { get: jest.Mock };

    beforeEach(() => {
        jest.clearAllMocks();
        mockConfig = { get: jest.fn() };
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
        yamlGenerator = new YamlGenerator();
    });

    describe('generate', () => {
        // Helper to set up mockConfig.get for common scenarios
        const setupMockConfig = (configValues: Record<string, any>) => {
            (mockConfig.get as jest.Mock<any>).mockImplementation(
                (key: string, defaultValue?: any) => {
                    return Object.prototype.hasOwnProperty.call(configValues, key) 
                        ? configValues[key] 
                        : defaultValue;
                });
        };

        test('空のディレクトリリストの場合、空の構造を持つYAMLを返すこと', async () => {
            setupMockConfig({ prefixText: '', maxFileSize: 1024 * 1024 });
            const result = await yamlGenerator.generate([]);
            const parsedResult = yaml.load(result);
            expect(parsedResult).toEqual({
                directory_structure: {},
                files: []
            });
        });

        test('prefixText が設定されていない場合 (デフォルト動作)、project_overview を含まない', async () => {
            setupMockConfig({ prefixText: '', maxFileSize: 1024 * 1024 });
            const dirInfo: DirectoryInfo = {
                uri: vscode.Uri.file('/root/dir1'),
                relativePath: 'dir1',
                files: [
                    { uri: vscode.Uri.file('/root/dir1/file1.txt'), relativePath: 'dir1/file1.txt', content: 'c1', language: 'l1', size: 1 }
                ],
                directories: new Map()
            };
            const result = await yamlGenerator.generate([dirInfo]);
            const parsedResult = yaml.load(result) as any;
            expect(parsedResult.project_overview).toBeUndefined();
        });

        test('prefixText が設定されている場合、project_overview を含む', async () => {
            const prefix = 'Test Project Overview';
            setupMockConfig({ prefixText: prefix, maxFileSize: 1024 * 1024 });
            const dirInfo: DirectoryInfo = { files: [{ uri: vscode.Uri.file('/f.txt'), relativePath:'f.txt', content:'',language:'',size:0}], directories: new Map(), relativePath: '.', uri: vscode.Uri.file('/') };
            const result = await yamlGenerator.generate([dirInfo]);
            const parsedResult = yaml.load(result) as any;
            expect(parsedResult.project_overview).toBe(prefix);
            expect(Object.keys(parsedResult)[0]).toBe('project_overview');
        });

        test('単一のファイルを含むルートディレクトリ (. relativePath)', async () => {
            setupMockConfig({ prefixText: '', maxFileSize: 1024 * 1024 });
            const file: FileInfo = { uri: vscode.Uri.file('/test/file1.ts'), relativePath: 'file1.ts', content: 'c', language: 'ts', size: 10 };
            const dir: DirectoryInfo = {
                uri: vscode.Uri.file('/test'), relativePath: '.',
                files: [file], directories: new Map()
            };
            const result = await yamlGenerator.generate([dir]);
            const parsedResult = yaml.load(result) as any;
            expect(parsedResult.directory_structure).toEqual({ 'file1.ts': null });
            expect(parsedResult.files).toEqual([{ path: 'file1.ts', size: 10, language: 'ts', content: 'c' }]);
        });

        test('単一のファイルを含む名前付きディレクトリ', async () => {
            setupMockConfig({ prefixText: '', maxFileSize: 1024 * 1024 });
            const file: FileInfo = { uri: vscode.Uri.file('/test/src/file1.ts'), relativePath: 'src/file1.ts', content: 'c', language: 'ts', size: 10 };
            const dir: DirectoryInfo = {
                uri: vscode.Uri.file('/test/src'), relativePath: 'src',
                files: [file], directories: new Map()
            };
            const result = await yamlGenerator.generate([dir]);
            const parsedResult = yaml.load(result) as any;
            expect(parsedResult.directory_structure).toEqual({ src: { 'file1.ts': null } });
            expect(parsedResult.files).toEqual([{ path: 'src/file1.ts', size: 10, language: 'ts', content: 'c' }]);
        });

        test('複数のファイルとネストしたディレクトリ', async () => {
            setupMockConfig({ prefixText: '', maxFileSize: 1024 * 1024 });
            const file1: FileInfo = { uri: vscode.Uri.file('/README.md'), relativePath: 'README.md', content: '#P', language: 'md', size: 10 };
            const subFile: FileInfo = { uri: vscode.Uri.file('/src/main.ts'), relativePath: 'src/main.ts', content: 'main', language: 'ts', size: 20 };
            const subDir: DirectoryInfo = { uri: vscode.Uri.file('/src'), relativePath: 'src', files: [subFile], directories: new Map() };
            const rootDir: DirectoryInfo = { uri: vscode.Uri.file('/'), relativePath: '.', files: [file1], directories: new Map([['src', subDir]]) };
            const result = await yamlGenerator.generate([rootDir]);
            const parsedResult = yaml.load(result) as any;
            expect(parsedResult.directory_structure).toEqual({ 'README.md': null, src: { 'main.ts': null } });
            expect(parsedResult.files.sort((a:any,b:any)=>a.path.localeCompare(b.path))).toEqual([
                { path: 'README.md', size: 10, language: 'md', content: '#P' },
                { path: 'src/main.ts', size: 20, language: 'ts', content: 'main' }
            ].sort((a,b) => a.path.localeCompare(b.path)));
        });

        test('maxFileSize 設定で大きなファイルが除外される', async () => {
            setupMockConfig({ prefixText: '', maxFileSize: 50 });
            const fileSmall: FileInfo = { uri: vscode.Uri.file('/s.txt'), relativePath: 's.txt', content: 'small', language: 't', size: 10 };
            const fileLarge: FileInfo = { uri: vscode.Uri.file('/l.txt'), relativePath: 'l.txt', content: 'large_content', language: 't', size: 100 };
            const dir: DirectoryInfo = { uri: vscode.Uri.file('/'), relativePath: '.', files: [fileSmall, fileLarge], directories: new Map() };
            const result = await yamlGenerator.generate([dir]);
            const parsedResult = yaml.load(result) as any;
            expect(parsedResult.directory_structure).toEqual({ 's.txt': null, 'l.txt': null });
            expect(parsedResult.files).toEqual([{ path: 's.txt', size: 10, language: 't', content: 'small' }]);
        });

        test('ファイルサイズが数値としてYAMLに出力される', async () => {
            setupMockConfig({ prefixText: '', maxFileSize: 1024 * 1024 });
            const file: FileInfo = { uri: vscode.Uri.file('/f.txt'), relativePath: 'f.txt', content: 'c', language: 't', size: 12345 };
            const dir: DirectoryInfo = { uri: vscode.Uri.file('/'), relativePath: '.', files: [file], directories: new Map() };
            const result = await yamlGenerator.generate([dir]);
            const parsedResult = yaml.load(result) as any;
            expect(parsedResult.files[0].size).toBe(12345);
        });
    });
}); 