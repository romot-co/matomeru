import * as vscode from 'vscode';
import { FileOperations } from './fileOperations';
import { MarkdownGenerator } from './markdownGenerator';
import { showInEditor, copyToClipboard, openInChatGPT } from './ui';
import { Logger } from './utils/logger';
import { formatFileSize } from './utils/fileUtils';

export class CommandRegistrar {
    private readonly fileOps: FileOperations;
    private readonly markdownGen: MarkdownGenerator;
    private readonly logger: Logger;

    constructor() {
        // ワークスペースのルートパスを取得
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            throw new Error(vscode.l10n.t('msg.workspaceNotFound'));
        }
        this.fileOps = new FileOperations(workspaceRoot);
        this.markdownGen = new MarkdownGenerator();
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

    private async processDirectories(uris: vscode.Uri[]): Promise<string> {
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
                            useVscodeignore: config.get('useVscodeignore', false)
                        });
                        this.fileOps.setCurrentSelectedPath(undefined);
                        return result;
                    } catch (error) {
                        this.logger.error(vscode.l10n.t('msg.scanError', index + 1, uri.fsPath, error instanceof Error ? error.message : String(error)));
                        throw error;
                    }
                })
            );
            return this.markdownGen.generate(dirInfos);
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

            const markdown = await this.processDirectories(selectedUris);
            await showInEditor(markdown);
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

            const markdown = await this.processDirectories(selectedUris);
            await copyToClipboard(markdown);
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

            const markdown = await this.processDirectories(selectedUris);
            await openInChatGPT(markdown);
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
                try {
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
                } catch (error) {
                    this.logger.error(`見積りエラー: ${error instanceof Error ? error.message : String(error)}`);
                }
            }

            // トークン数を概算（文字バイト数を4で割った値を使用）
            const estimatedTokens = Math.ceil(totalSize / 4);
            const formattedSize = formatFileSize(totalSize);
            
            // マークダウン形式のための追加サイズを考慮
            const markdownOverhead = totalFiles * 100; // ファイルごとにヘッダー情報や区切り文字などが追加されると仮定
            const totalEstimatedSize = totalSize + markdownOverhead;
            const totalEstimatedTokens = Math.ceil(totalEstimatedSize / 4);
            const formattedTotalSize = formatFileSize(totalEstimatedSize);

            vscode.window.showInformationMessage(
                vscode.l10n.t(
                    'msg.sizeEstimation',
                    totalFiles.toString(),
                    formattedSize,
                    estimatedTokens.toString(),
                    formattedTotalSize,
                    totalEstimatedTokens.toString()
                )
            );
            
            this.logger.info(`サイズ見積り結果: ${totalFiles}ファイル, ${formattedSize}, 約${estimatedTokens}トークン`);
            this.logger.info(`Markdown変換後の見積り: ${formattedTotalSize}, 約${totalEstimatedTokens}トークン`);
        } catch (error) {
            this.logger.error(error instanceof Error ? error.message : String(error));
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
} 