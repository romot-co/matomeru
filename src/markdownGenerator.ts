import { DirectoryInfo, FileInfo } from './types/fileTypes';
import { DirectoryStructure } from './directoryStructure';
import * as vscode from 'vscode';
import { stripComments } from './utils/compressUtils';
import { getExtensionContext } from './extension';
import { Logger } from './utils/logger';

const logger = Logger.getInstance('MarkdownGenerator');

export class MarkdownGenerator {
    constructor(
        private readonly directoryStructure: DirectoryStructure = new DirectoryStructure()
    ) {}

    async generate(directories: DirectoryInfo[]): Promise<string> {
        if (!directories.length) {
            return '';
        }

        const sections: string[] = [];

        // 設定から固定文言を取得
        const config = vscode.workspace.getConfiguration('matomeru');
        const prefixText = config.get<string>('prefixText', '');

        // 固定文言があれば追加
        if (prefixText) {
            sections.push(prefixText + '\n');
        }

        // ディレクトリ構造を追加
        sections.push(this.directoryStructure.generate(directories));

        // ファイルの内容を追加
        sections.push('\n# File Contents\n');
        
        const allFiles = this.getAllFiles(directories);
        for (const file of allFiles) {
            sections.push(await this.generateFileSection(file));
        }

        return sections.join('\n');
    }

    private getAllFiles(directories: DirectoryInfo[]): FileInfo[] {
        const result: FileInfo[] = [];
        for (const dir of directories) {
            this.collectFiles(dir, result);
        }
        return result.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    }

    private collectFiles(dir: DirectoryInfo, result: FileInfo[]): void {
        result.push(...dir.files);
        for (const subDir of dir.directories.values()) {
            this.collectFiles(subDir, result);
        }
    }

    private async generateFileSection(file: FileInfo): Promise<string> {
        const sections: string[] = [];

        // ファイル名をヘッダーとして追加
        sections.push(`## ${file.relativePath}\n`);

        // ファイルの情報を追加
        sections.push(`- Size: ${this.formatFileSize(file.size)}`);
        sections.push(`- Language: ${file.language}\n`);

        // コード圧縮機能が有効な場合、Tree-sitterを使ってコメントを削除
        const config = vscode.workspace.getConfiguration('matomeru');
        let content = file.content;
        
        if (config.get('enableCompression')) {
            try {
                const ctx = getExtensionContext();
                content = await stripComments(file.content, file.language, ctx);
                
                // コンテンツが変更された場合にはログを残す
                if (content !== file.content) {
                    logger.info(`Compressed content for ${file.relativePath}`);
                }
            } catch (error) {
                logger.error(`Failed to compress content: ${error}`);
            }
        }

        // ファイルの内容をコードブロックとして追加
        sections.push('```' + file.language);
        sections.push(content);
        sections.push('```\n');

        return sections.join('\n');
    }

    private formatFileSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        // 小数点以下が0の場合は整数表示、それ以外は小数点以下1桁
        const formattedSize = size % 1 === 0 ? size.toFixed(0) : size.toFixed(1);
        return `${formattedSize} ${units[unitIndex]}`;
    }
} 