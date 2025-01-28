import { FSAdapter } from './fs-adapter';
import * as path from 'path';
import { ScanProgress, ScanResult, DirectoryScannerOptions } from '../types';
import { ChatGPTUIError } from '../errors/ChatGPTErrors';
import { ConfigurationManager } from './configuration-manager';
import * as vscode from 'vscode';
import { I18n } from '../i18n';

export class DirectoryScanner {
    private readonly options: DirectoryScannerOptions;
    private readonly configManager: ConfigurationManager;
    private readonly i18n: I18n;
    private disposable: vscode.Disposable;

    constructor(
        private readonly fsAdapter: FSAdapter,
        private readonly onProgress?: (progress: ScanProgress) => void,
        options?: Partial<DirectoryScannerOptions>
    ) {
        this.configManager = ConfigurationManager.getInstance();
        this.i18n = I18n.getInstance();
        this.options = this.initializeOptions(options);
        this.disposable = this.watchConfiguration();
    }

    private initializeOptions(options?: Partial<DirectoryScannerOptions>): DirectoryScannerOptions {
        const config = this.configManager.getConfiguration();
        return {
            maxConcurrency: options?.maxConcurrency ?? config.maxConcurrentFiles,
            batchSize: options?.batchSize ?? 100,
            excludePatterns: options?.excludePatterns ?? config.excludePatterns,
            maxFileSize: options?.maxFileSize ?? config.maxFileSize
        };
    }

    private watchConfiguration(): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('matomeru')) {
                this.updateOptions();
            }
        });
    }

    private updateOptions(): void {
        const config = this.configManager.getConfiguration();
        this.options.maxConcurrency = config.maxConcurrentFiles;
        this.options.excludePatterns = config.excludePatterns;
        this.options.maxFileSize = config.maxFileSize;
    }

    dispose(): void {
        this.disposable.dispose();
    }

    private async processFile(file: string, shouldThrow = false): Promise<ScanResult | null> {
        try {
            const stats = await this.fsAdapter.stat(file);
            if (!stats.isSymbolicLink() && !stats.isDirectory()) {
                if (stats.size > this.options.maxFileSize) {
                    console.warn(`Skipping large file ${file}: ${stats.size} bytes`);
                    return null;
                }

                const content = await this.fsAdapter.readFile(file);
                const extension = this.fsAdapter.getFileExtension(file);
                return { path: file, content, extension };
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (shouldThrow) {
                throw new Error(errorMessage);
            } else {
                console.error(`Error processing file ${file}:`, errorMessage);
            }
        }
        return null;
    }

    private shouldExclude(filePath: string): boolean {
        return this.options.excludePatterns.some(pattern => {
            const regExp = new RegExp(pattern.replace(/\*/g, '.*'));
            return regExp.test(filePath);
        });
    }

    private reportProgress(file: string, processed: number, total: number): void {
        if (this.onProgress) {
            const progress = Math.round((processed / total) * 100);
            const message = processed === total
                ? this.i18n.t('ui.progress.processing')
                : this.i18n.t('ui.progress.collecting');
            this.onProgress({ progress, message });
        }
    }

    async scan(directory: string, shouldThrowOnError = false): Promise<ScanResult[]> {
        const results: ScanResult[] = [];
        let processed = 0;

        try {
            if (process.env.CHATGPT_NOT_RUNNING === 'true') {
                throw new ChatGPTUIError('ChatGPTアプリが起動していません');
            }

            // 選択されたディレクトリの絶対パスを取得
            const absolutePath = path.resolve(directory);
            
            // ワークスペースフォルダのチェック
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error(this.i18n.t('errors.noWorkspace'));
            }

            // 選択されたディレクトリを基準にグロブパターンを構築
            const pattern = '**/*';
            
            console.log('Target directory:', absolutePath);
            console.log('Using pattern:', pattern);

            // ファイル検索を実行（選択されたディレクトリを基準に）
            const files = await this.fsAdapter.findFiles(pattern, absolutePath);
            console.log('Found files:', files);

            // 除外パターンでフィルタリング
            const filteredFiles = files.filter(file => {
                const relativePath = path.relative(absolutePath, file);
                return !this.shouldExclude(relativePath);
            });
            console.log('Filtered files:', filteredFiles);

            const total = filteredFiles.length;

            // バッチ処理
            for (let i = 0; i < filteredFiles.length; i += this.options.batchSize) {
                const batch = filteredFiles.slice(i, i + this.options.batchSize);
                const batchPromises = batch.map(async file => {
                    try {
                        const result = await this.processFile(file, shouldThrowOnError);
                        processed++;
                        this.reportProgress(file, processed, total);
                        return result;
                    } catch (error) {
                        if (shouldThrowOnError) {
                            throw error;
                        }
                        console.error(`Error processing file ${file}:`, error);
                        processed++;
                        this.reportProgress(file, processed, total);
                        return null;
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults.filter((result): result is ScanResult => result !== null));
            }

            if (this.onProgress) {
                this.onProgress({
                    progress: 100,
                    message: this.i18n.t('ui.progress.processing')
                });
            }

            return results;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Scan error:', errorMessage);
            throw new Error(`Error scanning directory: ${errorMessage}`);
        }
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
        this.reportProgress(files[startIndex], progress, totalFiles);

        const promises = files.map(async (file) => {
            try {
                const stats = await this.fsAdapter.stat(file);
                if (stats.size > this.options.maxFileSize) {
                    console.warn(`Skipping large file ${file}: ${stats.size} bytes`);
                    return null;
                }

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

        const results: (ScanResult | null)[] = [];
        for (let i = 0; i < promises.length; i += this.options.maxConcurrency) {
            const batch = promises.slice(i, i + this.options.maxConcurrency);
            const batchResults = await Promise.all(batch);
            results.push(...batchResults);
        }

        return results.filter((result): result is ScanResult => result !== null);
    }
} 