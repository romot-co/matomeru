import * as fs from 'fs-extra';
import * as path from 'path';
import fg from 'fast-glob';

export interface FileSystemAdapter {
    readFile(filePath: string): Promise<string>;
    findFiles(directory: string, patterns?: string[]): Promise<string[]>;
    getFileExtension(filePath: string): string;
    exists(filePath: string): Promise<boolean>;
    stat(filePath: string): Promise<fs.Stats>;
}

export class ProductionFSAdapter implements FileSystemAdapter {
    /**
     * ファイルの内容を読み込む
     */
    async readFile(filePath: string): Promise<string> {
        return fs.readFile(filePath, 'utf-8');
    }

    /**
     * ディレクトリ内のファイルを検索する
     */
    async findFiles(directory: string, patterns: string[] = ['**/*']): Promise<string[]> {
        const options = {
            cwd: directory,
            absolute: true,
            dot: false,
            ignore: ['**/node_modules/**', '**/.git/**']
        };

        return fg.sync(patterns, options);
    }

    /**
     * ファイルの拡張子を取得する
     */
    getFileExtension(filePath: string): string {
        return path.extname(filePath).slice(1).toLowerCase();
    }

    /**
     * ファイルが存在するか確認する
     */
    async exists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * ファイルの統計情報を取得する
     */
    async stat(filePath: string): Promise<fs.Stats> {
        return fs.stat(filePath);
    }
}

export class MockFSAdapter implements FileSystemAdapter {
    constructor(private mockFiles: Record<string, string>) {}

    async readFile(filePath: string): Promise<string> {
        const content = this.mockFiles[filePath];
        if (content === undefined) {
            throw new Error(`File not found: ${filePath}`);
        }
        return content;
    }

    async findFiles(directory: string, patterns: string[] = ['**/*']): Promise<string[]> {
        return Object.keys(this.mockFiles);
    }

    getFileExtension(filePath: string): string {
        return path.extname(filePath).slice(1).toLowerCase();
    }

    async exists(filePath: string): Promise<boolean> {
        return filePath in this.mockFiles;
    }

    async stat(filePath: string): Promise<fs.Stats> {
        if (!(filePath in this.mockFiles)) {
            throw new Error(`File not found: ${filePath}`);
        }
        return fs.statSync(__filename); // ダミーの統計情報を返す
    }
} 
