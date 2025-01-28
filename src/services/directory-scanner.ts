import { FileSystemAdapter } from './fs-adapter';
import { DirectoryScannerOptions, ScanResult, ScanProgress } from '../types';
import * as path from 'path';

export class DirectoryScanner {
    private readonly fsAdapter: FileSystemAdapter;
    private readonly options: DirectoryScannerOptions;
    private onProgress?: (progress: ScanProgress) => void;

    constructor(
        fsAdapter: FileSystemAdapter,
        onProgress?: (progress: ScanProgress) => void,
        options?: Partial<DirectoryScannerOptions>
    ) {
        this.fsAdapter = fsAdapter;
        this.onProgress = onProgress;
        this.options = {
            maxConcurrency: options?.maxConcurrency ?? 5,
            batchSize: options?.batchSize ?? 100,
            excludePatterns: options?.excludePatterns ?? ['node_modules/**', '.git/**']
        };
    }

    /**
     * ディレクトリをスキャンしてファイルを収集する
     */
    async scan(directory: string): Promise<ScanResult[]> {
        this.reportProgress(0, 'ディレクトリをスキャン中...');

        const files = await this.fsAdapter.findFiles(directory, ['**/*']);
        const filteredFiles = this.filterFiles(files);
        const results: ScanResult[] = [];

        for (let i = 0; i < filteredFiles.length; i += this.options.batchSize) {
            const batch = filteredFiles.slice(i, i + this.options.batchSize);
            const batchResults = await this.processBatch(batch, i, filteredFiles.length);
            results.push(...batchResults);
        }

        this.reportProgress(100, '完了');
        return results;
    }

    /**
     * ファイルをフィルタリングする
     */
    private filterFiles(files: string[]): string[] {
        const excludePatterns = this.options.excludePatterns.map(pattern => 
            new RegExp(pattern.replace(/\*/g, '.*'))
        );

        return files.filter(file => {
            const relativePath = path.relative(process.cwd(), file);
            return !excludePatterns.some(pattern => pattern.test(relativePath));
        });
    }

    /**
     * ファイルのバッチを処理する
     */
    private async processBatch(
        files: string[],
        startIndex: number,
        totalFiles: number
    ): Promise<ScanResult[]> {
        const progress = Math.round((startIndex / totalFiles) * 100);
        this.reportProgress(progress, 'ファイルを処理中...');

        const promises = files.map(async (file) => {
            try {
                const content = await this.fsAdapter.readFile(file);
                return {
                    path: file,
                    content,
                    extension: this.fsAdapter.getFileExtension(file)
                };
            } catch (error) {
                console.error(`Error reading file ${file}:`, error);
                return null;
            }
        });

        const results = await Promise.all(promises);
        return results.filter((result): result is ScanResult => result !== null);
    }

    /**
     * 進行状況を報告する
     */
    private reportProgress(progress: number, message: string): void {
        this.onProgress?.({
            progress,
            message
        });
    }
} 