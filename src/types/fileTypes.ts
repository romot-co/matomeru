import * as vscode from 'vscode';

export interface FileInfo {
    uri: vscode.Uri;
    relativePath: string;
    content: string;
    language: string;
    size: number;
}

export interface DirectoryInfo {
    uri: vscode.Uri;
    relativePath: string;
    files: FileInfo[];
    directories: Map<string, DirectoryInfo>;
}

export interface ScanOptions {
    maxFileSize: number;
    excludePatterns: string[];
} 