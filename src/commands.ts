import * as vscode from 'vscode';
import { FileOperations } from './fileOperations';
import { MarkdownGenerator } from './markdownGenerator';
import { showInEditor, copyToClipboard, openInChatGPT } from './ui';
import { Logger } from './utils/logger';

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
                            useGitignore: config.get('useGitignore', false)
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