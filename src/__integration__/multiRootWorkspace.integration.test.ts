import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { FileOperations } from '../fileOperations';

jest.mock('vscode');

describe('MultiRoot Workspace Integration Tests', () => {
    let mockWorkspaceFolders: vscode.WorkspaceFolder[];
    let fileOperations: FileOperations;

    beforeEach(() => {
        jest.clearAllMocks();

        // マルチルートワークスペースの設定
        mockWorkspaceFolders = [
            {
                uri: vscode.Uri.file('/workspace/frontend'),
                name: 'frontend',
                index: 0
            },
            {
                uri: vscode.Uri.file('/workspace/backend'),
                name: 'backend',
                index: 1
            }
        ];

        (vscode.workspace.workspaceFolders as any) = mockWorkspaceFolders;
        
        fileOperations = new FileOperations('/workspace/frontend');
    });

    describe('Workspace Detection Integration', () => {
        test('should correctly identify workspace for real file paths', () => {
            const frontendFile = '/workspace/frontend/src/app.tsx';
            const backendFile = '/workspace/backend/main.py';

            expect(fileOperations.getWorkspaceRootForPath(frontendFile)).toBe('/workspace/frontend');
            expect(fileOperations.getWorkspaceRootForPath(backendFile)).toBe('/workspace/backend');
        });

        test('should group mixed workspace files correctly', () => {
            const mixedFiles = [
                vscode.Uri.file('/workspace/frontend/src/app.tsx'),
                vscode.Uri.file('/workspace/backend/main.py'),
                vscode.Uri.file('/workspace/frontend/package.json'),
                vscode.Uri.file('/workspace/backend/requirements.txt'),
            ];

            const groups = fileOperations.groupFilesByWorkspace(mixedFiles);

            expect(groups.size).toBe(2);
            expect(groups.get('/workspace/frontend')?.length).toBe(2);
            expect(groups.get('/workspace/backend')?.length).toBe(2);
        });
    });

    describe('Error Handling in Multi-Workspace Scenarios', () => {
        test('should handle workspace detection for invalid paths', () => {
            const invalidPath = '/completely/different/path/file.ts';
            const workspaceRoot = fileOperations.getWorkspaceRootForPath(invalidPath);
            
            // Should fallback to first workspace
            expect(workspaceRoot).toBe('/workspace/frontend');
        });

        test('should handle single workspace fallback', () => {
            // Override with single workspace
            (vscode.workspace.workspaceFolders as any) = [{
                uri: vscode.Uri.file('/single-workspace'),
                name: 'single',
                index: 0
            }];

            const newFileOps = new FileOperations('/single-workspace');
            const result = newFileOps.getWorkspaceRootForPath('/single-workspace/file.ts');
            
            expect(result).toBe('/single-workspace');
        });
    });
});