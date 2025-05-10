import * as vscode from 'vscode';
import { FileOperations } from './fileOperations';
import { DirectoryInfo, ScanOptions } from './types/fileTypes';
import { MarkdownGenerator } from './generators/MarkdownGenerator';
import { YamlGenerator } from './generators/YamlGenerator';
import { IGenerator } from './generators/IGenerator';
import { showInEditor, copyToClipboard, openInChatGPT } from './ui';
import { Logger } from './utils/logger';
import { formatFileSize, formatTokenCount } from './utils/fileUtils';
import { collectChangedFiles, GitNotRepositoryError, GitCliNotFoundError } from './utils/gitUtils';

export class CommandRegistrar {
    private readonly fileOps: FileOperations;
    private readonly logger: Logger;
    private readonly workspaceRoot: string;

    constructor() {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            throw new Error(vscode.l10n.t('msg.workspaceNotFound'));
        }
        this.workspaceRoot = workspaceRoot;
        this.fileOps = new FileOperations(workspaceRoot);
        this.logger = Logger.getInstance('CommandRegistrar');
    }

    /**
     * CommandRegistrarクラスとFileOperationsクラスのリソースを解放
     */
    dispose(): void {
        // FileOperationsのdisposeメソッドを呼び出してリソースを解放
        this.fileOps.dispose();
        this.logger.info('CommandRegistrarのリソースを解放しました');
    }

    private async getGenerator(): Promise<IGenerator> {
        const config = vscode.workspace.getConfiguration('matomeru');
        const format = config.get<'markdown' | 'yaml'>('outputFormat', 'markdown');
        if (format === 'yaml') {
            return new YamlGenerator();
        }
        return new MarkdownGenerator();
    }

    private async processDirectories(uris: vscode.Uri[]): Promise<{content: string, format: 'markdown' | 'yaml'}> {
        try {
            this.logger.info(vscode.l10n.t('msg.processingUris', uris.length));
            uris.forEach((uri, index) => {
                this.logger.info(vscode.l10n.t('msg.scanningUri', index + 1, uri.fsPath, uri.scheme));
            });

            const config = vscode.workspace.getConfiguration('matomeru');
            const dirInfos = await Promise.all(
                uris.map(async (uri, index) => {
                    this.logger.info(vscode.l10n.t('msg.scanningDirectory', index + 1, uri.fsPath));
                    try {
                        this.fileOps.setCurrentSelectedPath(uri.fsPath);
                        const result = await this.fileOps.scanDirectory(uri.fsPath, {
                            maxFileSize: config.get('maxFileSize', 1048576),
                            excludePatterns: config.get('excludePatterns', []),
                            useGitignore: config.get('useGitignore', false),
                            useVscodeignore: config.get('useVscodeignore', false),
                            includeDependencies: config.get('includeDependencies', false)
                        } as ScanOptions);
                        this.fileOps.setCurrentSelectedPath(undefined);
                        return result;
                    } catch (error) {
                        this.logger.error(vscode.l10n.t('msg.scanError', index + 1, uri.fsPath, error instanceof Error ? error.message : String(error)));
                        throw error;
                    }
                })
            );
            const generator = await this.getGenerator();
            const outputFormat = vscode.workspace.getConfiguration('matomeru').get<'markdown' | 'yaml'>('outputFormat', 'markdown');
            const content = await generator.generate(dirInfos.filter(Boolean) as DirectoryInfo[]);
            return { content, format: outputFormat };
        } catch (error) {
            this.logger.error(vscode.l10n.t('msg.directoryProcessingError') + (error instanceof Error ? error.message : String(error)));
            throw error;
        }
    }

    async processToEditor(uri?: vscode.Uri, uris?: vscode.Uri[]): Promise<void> {
        try {
            const selectedUris = uris || (uri ? [uri] : await this.getSelectedUris());
            if (!selectedUris || selectedUris.length === 0) {
                this.logger.warn(vscode.l10n.t('msg.noSelection'));
                return;
            }

            this.logger.info(vscode.l10n.t('msg.selectedUris', selectedUris.length));
            for (const [index, uri] of selectedUris.entries()) {
                try {
                    const stats = await vscode.workspace.fs.stat(uri);
                    this.logger.info(vscode.l10n.t('msg.selectedUriInfo', index + 1, uri.fsPath, stats.type === vscode.FileType.Directory ? 'directory' : 'file'));
                } catch (error) {
                    this.logger.info(vscode.l10n.t('msg.selectedUriInfo', index + 1, uri.fsPath, 'unknown'));
                }
            }

            const { content, format } = await this.processDirectories(selectedUris);
            await showInEditor(content, format);
            this.logger.info(vscode.l10n.t('msg.outputToEditor'));
        } catch (error) {
            this.logger.error(error instanceof Error ? error.message : String(error));
        }
    }

    async processToClipboard(uri?: vscode.Uri, uris?: vscode.Uri[]): Promise<void> {
        try {
            const selectedUris = uris || (uri ? [uri] : await this.getSelectedUris());
            if (!selectedUris.length) {
                throw new Error(vscode.l10n.t('msg.noSelection'));
            }

            const { content } = await this.processDirectories(selectedUris);
            await copyToClipboard(content);
            this.logger.info(vscode.l10n.t('msg.copiedToClipboard'));
        } catch (error) {
            this.logger.error(error instanceof Error ? error.message : String(error));
        }
    }

    async processToChatGPT(uri?: vscode.Uri, uris?: vscode.Uri[]): Promise<void> {
        try {
            const selectedUris = uris || (uri ? [uri] : await this.getSelectedUris());
            if (!selectedUris.length) {
                throw new Error(vscode.l10n.t('msg.noSelection'));
            }

            const { content } = await this.processDirectories(selectedUris);
            await openInChatGPT(content);
            this.logger.info(vscode.l10n.t('msg.sentToChatGPT'));
        } catch (error) {
            this.logger.error(error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * 選択されたディレクトリやファイルのサイズを見積もり、およそのトークン数を表示する
     * @param uri 対象のURI
     * @param uris 対象のURI配列
     */
    async estimateSize(uri?: vscode.Uri, uris?: vscode.Uri[]): Promise<void> {
        try {
            const selectedUris = uris || (uri ? [uri] : await this.getSelectedUris());
            if (!selectedUris.length) {
                throw new Error(vscode.l10n.t('msg.noSelection'));
            }

            let totalFiles = 0;
            let totalSize = 0;
            const config = vscode.workspace.getConfiguration('matomeru');

            // 各URIごとに見積りを行い、合計を計算
            for (const [index, uri] of selectedUris.entries()) {
                this.logger.info(`見積り中: ${index + 1}/${selectedUris.length} ${uri.fsPath}`);
                this.fileOps.setCurrentSelectedPath(uri.fsPath);
                const result = await this.fileOps.estimateDirectorySize(uri.fsPath, {
                    maxFileSize: config.get('maxFileSize', 1048576),
                    excludePatterns: config.get('excludePatterns', []),
                    useGitignore: config.get('useGitignore', false),
                    useVscodeignore: config.get('useVscodeignore', false)
                });
                
                totalFiles += result.totalFiles;
                totalSize += result.totalSize;
                
                this.fileOps.setCurrentSelectedPath(undefined);
            }

            // トークン数を概算（文字バイト数を3.5で割った値を使用し、精度を少し向上）
            const estimatedTokens = Math.ceil(totalSize / 3.5);
            const formattedSize = formatFileSize(totalSize);
            const formattedTokens = formatTokenCount(estimatedTokens);
            
            // マークダウン形式のための追加サイズを考慮
            const markdownOverhead = totalFiles * 100; // ファイルごとにヘッダー情報や区切り文字などが追加されると仮定
            const totalEstimatedSize = totalSize + markdownOverhead;
            const totalEstimatedTokens = Math.ceil(totalEstimatedSize / 3.5);
            const formattedTotalSize = formatFileSize(totalEstimatedSize);
            const formattedTotalTokens = formatTokenCount(totalEstimatedTokens);

            vscode.window.showInformationMessage(
                vscode.l10n.t(
                    'msg.sizeEstimation',
                    totalFiles.toString(),
                    formattedSize,
                    formattedTokens,
                    formattedTotalSize,
                    formattedTotalTokens
                )
            );
            
            this.logger.info(`サイズ見積り結果: ${totalFiles}ファイル, ${formattedSize}, 約${formattedTokens}トークン`);
            this.logger.info(`Markdown変換後の見積り: ${formattedTotalSize}, 約${formattedTotalTokens}トークン`);
        } catch (error) {
            this.logger.error(`見積り処理中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
            vscode.window.showErrorMessage(`見積りエラー: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async getSelectedUris(): Promise<vscode.Uri[]> {
        if (!vscode.workspace.workspaceFolders) {
            throw new Error(vscode.l10n.t('msg.workspaceNotFound'));
        }

        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: true,
            canSelectMany: true,
            openLabel: vscode.l10n.t('msg.selectButton'),
            defaultUri: vscode.workspace.workspaceFolders[0].uri
        }) || [];

        // URIのfsPathをキーにして一意化
        return Array.from(new Map(uris.map(uri => [uri.fsPath, uri])).values());
    }

    /**
     * GitのDiff情報をクリップボードにコピーする
     * @param _uri 未使用（コマンドハンドラーシグネチャと一致させるため）
     * @param _uris 未使用（コマンドハンドラーシグネチャと一致させるため）
     */
    async diffToClipboard(_uri?: vscode.Uri, _uris?: vscode.Uri[]): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('matomeru');
            const range = config.get<string>('gitDiff.range');
            
            const result = await this.processGitDiff(range);
            if (result) {
                await copyToClipboard(result.content);
                this.logger.info(vscode.l10n.t('msg.copiedToClipboard'));
            }
        } catch (error) {
            this.handleGitError(error);
        }
    }

    /**
     * GitのDiff情報をエディタに表示する
     * @param _uri 未使用（コマンドハンドラーシグネチャと一致させるため）
     * @param _uris 未使用（コマンドハンドラーシグネチャと一致させるため）
     */
    async diffToEditor(_uri?: vscode.Uri, _uris?: vscode.Uri[]): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('matomeru');
            const range = config.get<string>('gitDiff.range');
            
            const result = await this.processGitDiff(range);
            if (result) {
                await showInEditor(result.content, result.format);
                this.logger.info(vscode.l10n.t('msg.outputToEditor'));
            }
        } catch (error) {
            this.handleGitError(error);
        }
    }

    /**
     * GitのDiff情報をChatGPTに送信する
     * @param _uri 未使用（コマンドハンドラーシグネチャと一致させるため）
     * @param _uris 未使用（コマンドハンドラーシグネチャと一致させるため）
     */
    async diffToChatGPT(_uri?: vscode.Uri, _uris?: vscode.Uri[]): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('matomeru');
            const range = config.get<string>('gitDiff.range');
            
            const result = await this.processGitDiff(range);
            if (result) {
                await openInChatGPT(result.content);
                this.logger.info(vscode.l10n.t('msg.sentToChatGPT'));
            }
        } catch (error) {
            this.handleGitError(error);
        }
    }

    /**
     * Git変更ファイルからMarkdownを生成する共通処理
     * @param range オプションのリビジョン範囲
     * @returns 生成されたMarkdown、または変更がない場合はundefined
     */
    private async processGitDiff(range?: string): Promise<{content: string, format: 'markdown' | 'yaml'} | undefined> {
        const fileUris = await collectChangedFiles(this.workspaceRoot, range);
        
        if (fileUris.length === 0) {
            vscode.window.showInformationMessage(vscode.l10n.t('msg.noChanges'));
            return undefined;
        }
        
        const config = vscode.workspace.getConfiguration('matomeru');
        const scanOptions: ScanOptions = {
            maxFileSize: config.get('maxFileSize', 1048576),
            excludePatterns: config.get('excludePatterns', []),
            useGitignore: config.get('useGitignore', false),
            useVscodeignore: config.get('useVscodeignore', false)
        };
        
        const dirInfos = await this.fileOps.processFileList(fileUris, scanOptions);
        
        const generator = await this.getGenerator();
        const outputFormat = config.get<'markdown' | 'yaml'>('outputFormat', 'markdown');
        const content = await generator.generate(dirInfos.filter(Boolean) as DirectoryInfo[]);
        return { content, format: outputFormat };
    }

    /**
     * Git関連エラーのハンドリング
     */
    private handleGitError(error: unknown): void {
        if (error instanceof GitNotRepositoryError) {
            vscode.window.showErrorMessage(vscode.l10n.t('msg.noGitRepo'));
        } else if (error instanceof GitCliNotFoundError) {
            vscode.window.showErrorMessage(vscode.l10n.t('msg.gitCliNotFound'));
        } else {
            this.logger.error(`エラー: ${error instanceof Error ? error.message : String(error)}`);
            vscode.window.showErrorMessage(`${error instanceof Error ? error.message : String(error)}`);
        }
    }
} 