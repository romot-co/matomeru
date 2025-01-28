import * as vscode from 'vscode';
import * as path from 'path';

export interface FSAdapter {
    readFile(path: string): Promise<string>;
    stat(path: string): Promise<{ isDirectory: () => boolean; isSymbolicLink: () => boolean }>;
    readdir(path: string): Promise<string[]>;
    findFiles?(pattern: string): Promise<string[]>;
    getFileExtension?(filePath: string): string;
    exists?(path: string): Promise<boolean>;
}

export class FileSystemAdapter implements FSAdapter {
    async readFile(path: string): Promise<string> {
        const uri = vscode.Uri.file(path);
        const content = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(content).toString('utf-8');
    }

    async stat(path: string): Promise<{ isDirectory: () => boolean; isSymbolicLink: () => boolean }> {
        const uri = vscode.Uri.file(path);
        const stat = await vscode.workspace.fs.stat(uri);
        return {
            isDirectory: () => (stat.type & vscode.FileType.Directory) !== 0,
            isSymbolicLink: () => (stat.type & vscode.FileType.SymbolicLink) !== 0
        };
    }

    async readdir(path: string): Promise<string[]> {
        const uri = vscode.Uri.file(path);
        const entries = await vscode.workspace.fs.readDirectory(uri);
        return entries.map(([name]) => name);
    }

    async findFiles(pattern: string): Promise<string[]> {
        const files = await vscode.workspace.findFiles(pattern);
        return files.map(file => file.fsPath);
    }

    getFileExtension(filePath: string): string {
        return path.extname(filePath).toLowerCase();
    }

    async exists(path: string): Promise<boolean> {
        try {
            const uri = vscode.Uri.file(path);
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }
}

export class MockFSAdapter implements FSAdapter {
    constructor(private mockFiles: Record<string, string>) {}

    async readFile(filePath: string): Promise<string> {
        if (!(filePath in this.mockFiles)) {
            throw new Error(`File not found: ${filePath}`);
        }
        return this.mockFiles[filePath];
    }

    async stat(filePath: string): Promise<{ isDirectory: () => boolean; isSymbolicLink: () => boolean }> {
        if (!(filePath in this.mockFiles)) {
            throw new Error(`File not found: ${filePath}`);
        }
        return {
            isDirectory: () => false,
            isSymbolicLink: () => false
        };
    }

    async readdir(path: string): Promise<string[]> {
        const files = Object.keys(this.mockFiles)
            .filter(filePath => filePath.startsWith(path))
            .map(filePath => filePath.replace(`${path}/`, ''));
        
        if (files.length === 0) {
            throw new Error(`Directory not found: ${path}`);
        }
        
        return files;
    }

    async findFiles(pattern: string): Promise<string[]> {
        return Object.keys(this.mockFiles);
    }

    getFileExtension(filePath: string): string {
        return path.extname(filePath).toLowerCase();
    }

    async exists(filePath: string): Promise<boolean> {
        return filePath in this.mockFiles;
    }
} 
