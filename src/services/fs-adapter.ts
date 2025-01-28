import * as vscode from 'vscode';
import * as path from 'path';
import { Dirent } from 'fs';

export interface FileStats {
    isDirectory: () => boolean;
    isSymbolicLink: () => boolean;
    size: number;
}

export interface FSAdapter {
    readFile(path: string): Promise<string>;
    stat(path: string): Promise<FileStats>;
    readdir(path: string): Promise<Dirent[]>;
    findFiles(pattern: string, baseDir?: string): Promise<string[]>;
    getFileExtension(filePath: string): string;
    exists(path: string): Promise<boolean>;
}

export class FileSystemAdapter implements FSAdapter {
    async readFile(path: string): Promise<string> {
        const uri = vscode.Uri.file(path);
        const content = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(content).toString('utf-8');
    }

    async stat(path: string): Promise<FileStats> {
        const uri = vscode.Uri.file(path);
        const stat = await vscode.workspace.fs.stat(uri);
        return {
            isDirectory: () => (stat.type & vscode.FileType.Directory) !== 0,
            isSymbolicLink: () => (stat.type & vscode.FileType.SymbolicLink) !== 0,
            size: stat.size
        };
    }

    async readdir(path: string): Promise<Dirent[]> {
        const uri = vscode.Uri.file(path);
        const entries = await vscode.workspace.fs.readDirectory(uri);
        return entries.map(([name, type]) => ({
            name,
            isDirectory: () => (type & vscode.FileType.Directory) !== 0,
            isFile: () => (type & vscode.FileType.File) !== 0,
            isSymbolicLink: () => (type & vscode.FileType.SymbolicLink) !== 0,
            isBlockDevice: () => false,
            isCharacterDevice: () => false,
            isFIFO: () => false,
            isSocket: () => false
        } as Dirent));
    }

    async findFiles(pattern: string, baseDir?: string): Promise<string[]> {
        // ワークスペースフォルダが存在しない場合のエラー処理
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder is open');
        }

        try {
            // 基準ディレクトリを設定
            const searchRoot = baseDir ? vscode.Uri.file(baseDir) : workspaceFolder.uri;
            
            // VSCodeのワークスペースパターンを使用
            const globPattern = new vscode.RelativePattern(searchRoot, pattern);
            const files = await vscode.workspace.findFiles(globPattern, null);
            
            // 結果をログ出力
            console.log('Found files with pattern:', pattern);
            console.log('Base directory:', baseDir || 'workspace root');
            console.log('Files:', files.map(f => f.fsPath));
            
            return files.map(file => file.fsPath);
        } catch (error) {
            console.error('Error finding files:', error);
            throw error;
        }
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
    private mockFiles: Map<string, string>;
    private mockStats: Map<string, { isDirectory: boolean; isSymbolicLink: boolean; size: number }>;

    constructor() {
        this.mockFiles = new Map();
        this.mockStats = new Map();
    }

    async readFile(path: string): Promise<string> {
        const content = this.mockFiles.get(path);
        if (content === undefined) {
            throw new Error(`File not found: ${path}`);
        }
        return content;
    }

    async stat(path: string): Promise<FileStats> {
        const stats = this.mockStats.get(path);
        if (!stats) {
            throw new Error(`Stats not found for: ${path}`);
        }
        return {
            isDirectory: () => stats.isDirectory,
            isSymbolicLink: () => stats.isSymbolicLink,
            size: stats.size
        };
    }

    async readdir(path: string): Promise<Dirent[]> {
        const files = Array.from(this.mockFiles.keys())
            .filter(filePath => filePath.startsWith(path))
            .map(filePath => {
                const name = filePath.replace(`${path}/`, '').split('/')[0];
                const stats = this.mockStats.get(filePath) || { isDirectory: false, isSymbolicLink: false, size: 0 };
                return {
                    name,
                    isDirectory: () => stats.isDirectory,
                    isFile: () => !stats.isDirectory && !stats.isSymbolicLink,
                    isSymbolicLink: () => stats.isSymbolicLink,
                    isBlockDevice: () => false,
                    isCharacterDevice: () => false,
                    isFIFO: () => false,
                    isSocket: () => false
                } as Dirent;
            });
        
        if (files.length === 0) {
            throw new Error(`Directory not found: ${path}`);
        }
        
        return files;
    }

    async findFiles(pattern: string, baseDir?: string): Promise<string[]> {
        const files = Array.from(this.mockFiles.keys());
        const regExp = new RegExp(pattern.replace(/\*/g, '.*'));
        return files.filter(file => {
            if (baseDir && !file.startsWith(baseDir)) {
                return false;
            }
            return regExp.test(file);
        });
    }

    getFileExtension(filePath: string): string {
        return path.extname(filePath).toLowerCase();
    }

    async exists(path: string): Promise<boolean> {
        return this.mockFiles.has(path) || Array.from(this.mockFiles.keys()).some(key => key.startsWith(path + '/'));
    }

    setMockFile(path: string, content: string, isDirectory = false, isSymbolicLink = false) {
        this.mockFiles.set(path, content);
        this.mockStats.set(path, {
            isDirectory,
            isSymbolicLink,
            size: content.length
        });
    }

    clearMocks() {
        this.mockFiles.clear();
        this.mockStats.clear();
    }
}

export const ProductionFSAdapter = FileSystemAdapter; 
