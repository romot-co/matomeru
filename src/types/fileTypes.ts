import * as vscode from 'vscode';

export interface FileInfo {
    uri: vscode.Uri;
    relativePath: string;
    content: string;
    language: string;
    size: number;
    imports?: string[];
}

export interface DirectoryInfo {
    uri: vscode.Uri;
    relativePath: string;
    files: FileInfo[];
    directories: Map<string, DirectoryInfo>;
    imports?: string[];
}

export interface ScanOptions {
    maxFileSize: number;
    excludePatterns: string[];
    useGitignore?: boolean;
    useVscodeignore?: boolean;
    includeDependencies?: boolean;
} 