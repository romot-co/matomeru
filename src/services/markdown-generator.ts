import { ScanResult } from '../types';
import { FileTypeManager } from './FileTypeManager';
import * as path from 'path';
import * as vscode from 'vscode';

export interface FileEntity {
    type: 'file';
    path: string;
    content: string;
}

export interface DirectoryEntity {
    type: 'directory';
    path: string;
    children: (FileEntity | DirectoryEntity)[];
}

export class MarkdownGenerator {
    private fileTypeManager: FileTypeManager;

    constructor() {
        this.fileTypeManager = FileTypeManager.getInstance();
    }

    async generateMarkdown(files: ScanResult[]): Promise<string> {
        let markdown = '# コードベース概要\n\n';

        // ディレクトリ構造を生成
        markdown += '## 📁 ディレクトリ構造\n\n```\n';
        markdown += this.generateDirectoryTree(files);
        markdown += '```\n\n';

        // ファイルの概要を生成
        markdown += '## 📄 ファイル一覧\n\n';
        const filesByType = this.groupFilesByType(files);
        for (const [type, typeFiles] of Object.entries(filesByType)) {
            markdown += `### ${type} ファイル\n\n`;
            for (const file of typeFiles) {
                markdown += `- \`${file.path}\`\n`;
            }
            markdown += '\n';
        }

        // ファイルの詳細な内容
        markdown += '## 📝 ファイル詳細\n\n';
        for (const file of files) {
            const relativePath = this.getRelativePath(file.path);
            markdown += `### ${relativePath}\n\n`;
            const fileType = this.fileTypeManager.getFileType(file.path);
            markdown += '```' + fileType.languageId + '\n';
            markdown += file.content + '\n';
            markdown += '```\n\n';
        }

        return markdown;
    }

    private generateDirectoryTree(files: ScanResult[]): string {
        const tree: { [key: string]: boolean } = {};
        for (const file of files) {
            const parts = this.getRelativePath(file.path).split('/');
            let currentPath = '';
            for (const part of parts) {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                tree[currentPath] = true;
            }
        }

        const lines: string[] = [];
        const paths = Object.keys(tree).sort();
        for (const path of paths) {
            const depth = path.split('/').length - 1;
            const name = path.split('/').pop() || '';
            const prefix = '  '.repeat(depth) + (depth > 0 ? '├─ ' : '');
            lines.push(`${prefix}${name}`);
        }

        return lines.join('\n');
    }

    private groupFilesByType(files: ScanResult[]): { [key: string]: ScanResult[] } {
        const groups: { [key: string]: ScanResult[] } = {};
        for (const file of files) {
            const fileType = this.fileTypeManager.getFileType(file.path);
            const type = fileType.typeName;
            if (!groups[type]) {
                groups[type] = [];
            }
            groups[type].push(file);
        }
        return groups;
    }

    private getRelativePath(filePath: string): string {
        // ワークスペースのルートパスを取得
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return filePath;
        }

        try {
            const workspacePath = workspaceFolder.uri.fsPath;
            // 絶対パスに変換
            const absolutePath = path.resolve(filePath);
            // 相対パスを計算
            const relativePath = path.relative(workspacePath, absolutePath);
            // パスの区切り文字を正規化
            return relativePath.replace(/\\/g, '/');
        } catch (error) {
            console.error('Error calculating relative path:', error);
            return filePath;
        }
    }

    generate(entities: (FileEntity | DirectoryEntity)[]): string {
        return entities.map(entity => this.generateEntity(entity, 2)).join('\n\n');
    }

    private generateEntity(entity: FileEntity | DirectoryEntity, level: number): string {
        const header = '#'.repeat(level);
        const name = this.getEntityName(entity.path);

        if (entity.type === 'file') {
            const fileType = this.fileTypeManager.getFileType(entity.path);
            return `${header} 📄 ${name}\n\`\`\`${fileType.languageId}\n${entity.content}\n\`\`\``;
        } else {
            const content = entity.children.length > 0
                ? '\n\n' + entity.children.map(child => this.generateEntity(child, level + 1)).join('\n\n')
                : ' (空のディレクトリ)';
            return `${header} 📁 ${name}${content}`;
        }
    }

    private getEntityName(path: string): string {
        return path.split('/').pop() || path;
    }
}