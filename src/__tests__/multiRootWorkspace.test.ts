import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { FileOperations } from '../fileOperations';

jest.mock('vscode');

describe('MultiRoot Workspace Support', () => {
    let mockWorkspaceFolders: vscode.WorkspaceFolder[];
    let fileOperations: FileOperations;

    beforeEach(() => {
        jest.clearAllMocks();

        (vscode.workspace as any).onDidChangeWorkspaceFolders = jest.fn().mockReturnValue({ dispose: jest.fn() });
        
        // マルチルートワークスペースの設定
        mockWorkspaceFolders = [
            {
                uri: vscode.Uri.file('/workspace/project-a'),
                name: 'project-a',
                index: 0
            },
            {
                uri: vscode.Uri.file('/workspace/project-b'),
                name: 'project-b',
                index: 1
            },
            {
                uri: vscode.Uri.file('/workspace/project-c'),
                name: 'project-c',
                index: 2
            }
        ];

        (vscode.workspace.workspaceFolders as any) = mockWorkspaceFolders;
        
        fileOperations = new FileOperations('/workspace/project-a');
    });

    describe('FileOperations - Workspace Root Detection', () => {
        test('should detect correct workspace root for file in first workspace', () => {
            const filePath = '/workspace/project-a/src/index.ts';
            const workspaceRoot = fileOperations.getWorkspaceRootForPath(filePath);
            
            expect(workspaceRoot).toBe('/workspace/project-a');
        });

        test('should detect correct workspace root for file in second workspace', () => {
            const filePath = '/workspace/project-b/lib/utils.js';
            const workspaceRoot = fileOperations.getWorkspaceRootForPath(filePath);
            
            expect(workspaceRoot).toBe('/workspace/project-b');
        });

        test('should detect correct workspace root for file in third workspace', () => {
            const filePath = '/workspace/project-c/components/Button.tsx';
            const workspaceRoot = fileOperations.getWorkspaceRootForPath(filePath);
            
            expect(workspaceRoot).toBe('/workspace/project-c');
        });

        test('should fallback to first workspace for unknown path', () => {
            const filePath = '/unknown/path/file.txt';
            const workspaceRoot = fileOperations.getWorkspaceRootForPath(filePath);
            
            expect(workspaceRoot).toBe('/workspace/project-a');
        });

        test('should handle exact workspace folder path', () => {
            const filePath = '/workspace/project-b';
            const workspaceRoot = fileOperations.getWorkspaceRootForPath(filePath);
            
            expect(workspaceRoot).toBe('/workspace/project-b');
        });
    });

    describe('FileOperations - File Grouping by Workspace', () => {
        test('should group files by workspace correctly', () => {
            const uris = [
                vscode.Uri.file('/workspace/project-a/src/main.ts'),
                vscode.Uri.file('/workspace/project-a/src/utils.ts'),
                vscode.Uri.file('/workspace/project-b/lib/api.js'),
                vscode.Uri.file('/workspace/project-c/components/App.tsx'),
                vscode.Uri.file('/workspace/project-b/lib/helpers.js'),
            ];

            const groups = fileOperations.groupFilesByWorkspace(uris);

            expect(groups.size).toBe(3);
            
            // project-a should have 2 files
            expect(groups.get('/workspace/project-a')).toHaveLength(2);
            expect(groups.get('/workspace/project-a')).toEqual([
                vscode.Uri.file('/workspace/project-a/src/main.ts'),
                vscode.Uri.file('/workspace/project-a/src/utils.ts')
            ]);

            // project-b should have 2 files
            expect(groups.get('/workspace/project-b')).toHaveLength(2);
            expect(groups.get('/workspace/project-b')).toEqual([
                vscode.Uri.file('/workspace/project-b/lib/api.js'),
                vscode.Uri.file('/workspace/project-b/lib/helpers.js')
            ]);

            // project-c should have 1 file
            expect(groups.get('/workspace/project-c')).toHaveLength(1);
            expect(groups.get('/workspace/project-c')).toEqual([
                vscode.Uri.file('/workspace/project-c/components/App.tsx')
            ]);
        });

        test('should handle empty file list', () => {
            const uris: vscode.Uri[] = [];
            const groups = fileOperations.groupFilesByWorkspace(uris);

            expect(groups.size).toBe(0);
        });

        test('should handle files from single workspace', () => {
            const uris = [
                vscode.Uri.file('/workspace/project-a/src/main.ts'),
                vscode.Uri.file('/workspace/project-a/src/utils.ts'),
            ];

            const groups = fileOperations.groupFilesByWorkspace(uris);

            expect(groups.size).toBe(1);
            expect(groups.get('/workspace/project-a')).toHaveLength(2);
        });
    });

    describe('Single Workspace Fallback', () => {
        beforeEach(() => {
            // 単一ワークスペースの設定
            (vscode.workspace.workspaceFolders as any) = [{
                uri: vscode.Uri.file('/single-workspace'),
                name: 'single-project',
                index: 0
            }];

            fileOperations = new FileOperations('/single-workspace');
        });

        test('should use default workspace root for single workspace', () => {
            const filePath = '/single-workspace/src/index.ts';
            const workspaceRoot = fileOperations.getWorkspaceRootForPath(filePath);
            
            expect(workspaceRoot).toBe('/single-workspace');
        });

        test('should group all files under single workspace', () => {
            const uris = [
                vscode.Uri.file('/single-workspace/src/main.ts'),
                vscode.Uri.file('/single-workspace/lib/utils.js'),
            ];

            const groups = fileOperations.groupFilesByWorkspace(uris);

            expect(groups.size).toBe(1);
            expect(groups.get('/single-workspace')).toHaveLength(2);
        });
    });

    describe('No Workspace Scenario', () => {
        beforeEach(() => {
            // ワークスペースなしの設定
            (vscode.workspace.workspaceFolders as any) = undefined;
            fileOperations = new FileOperations('/default-workspace');
        });

        test('should fallback to constructor workspace root when no workspace folders', () => {
            const filePath = '/some/random/path/file.ts';
            const workspaceRoot = fileOperations.getWorkspaceRootForPath(filePath);
            
            expect(workspaceRoot).toBe('/default-workspace');
        });

        test('should use single group when no workspace folders', () => {
            const uris = [
                vscode.Uri.file('/some/path/file1.ts'),
                vscode.Uri.file('/another/path/file2.js'),
            ];

            const groups = fileOperations.groupFilesByWorkspace(uris);

            expect(groups.size).toBe(1);
            expect(groups.get('/default-workspace')).toHaveLength(2);
        });
    });

    describe('Path Edge Cases', () => {
        test('should handle paths with similar prefixes correctly', () => {
            // Similar workspace paths that could cause false matches
            (vscode.workspace.workspaceFolders as any) = [
                {
                    uri: vscode.Uri.file('/workspace/project'),
                    name: 'project',
                    index: 0
                },
                {
                    uri: vscode.Uri.file('/workspace/project-extended'),
                    name: 'project-extended',
                    index: 1
                }
            ];

            fileOperations = new FileOperations('/workspace/project');

            const filePath1 = '/workspace/project/src/index.ts';
            const filePath2 = '/workspace/project-extended/src/index.ts';

            expect(fileOperations.getWorkspaceRootForPath(filePath1)).toBe('/workspace/project');
            expect(fileOperations.getWorkspaceRootForPath(filePath2)).toBe('/workspace/project-extended');
        });

        test('should handle Windows-style paths correctly', () => {
            // project-bを最初に配置してテストする
            (vscode.workspace.workspaceFolders as any) = [
                {
                    uri: vscode.Uri.file('C:\\workspace\\project-b'),
                    name: 'project-b',
                    index: 0
                },
                {
                    uri: vscode.Uri.file('C:\\workspace\\project-a'),
                    name: 'project-a',
                    index: 1
                }
            ];

            fileOperations = new FileOperations('C:\\workspace\\project-b');

            const filePath = 'C:\\workspace\\project-b\\src\\index.ts';
            const workspaceRoot = fileOperations.getWorkspaceRootForPath(filePath);

            expect(workspaceRoot).toBe('C:\\workspace\\project-b');
        });
    });
});
