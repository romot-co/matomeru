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
            throw new Error('ワークスペースが開かれていません');
        }
        this.fileOps = new FileOperations(workspaceRoot);
        this.markdownGen = new MarkdownGenerator();
        this.logger = Logger.getInstance('CommandRegistrar');
    }

    register(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.commands.registerCommand('matomeru.process', this.processToEditor.bind(this)),
            vscode.commands.registerCommand('matomeru.quickProcessToEditor', this.processToEditor.bind(this)),
            vscode.commands.registerCommand('matomeru.quickProcessToClipboard', this.processToClipboard.bind(this)),
            vscode.commands.registerCommand('matomeru.quickProcessToChatGPT', this.processToChatGPT.bind(this))
        );
        this.logger.info('コマンドを登録しました');
    }

    private async processDirectories(uris: vscode.Uri[]): Promise<string> {
        try {
            const config = vscode.workspace.getConfiguration('matomeru');
            const dirInfos = await Promise.all(
                uris.map(uri => this.fileOps.scanDirectory(uri.fsPath, {
                    maxFileSize: config.get('maxFileSize', 1048576),
                    excludePatterns: config.get('excludePatterns', [])
                }))
            );
            return this.markdownGen.generate(dirInfos);
        } catch (error) {
            this.logger.error('ディレクトリ処理エラー:' + (error instanceof Error ? error.message : String(error)));
            throw error;
        }
    }

    private async processToEditor(uri?: vscode.Uri): Promise<void> {
        try {
            const uris = uri ? [uri] : await this.getSelectedUris();
            if (!uris.length) {
                throw new Error('ディレクトリまたはファイルが選択されていません');
            }

            const markdown = await this.processDirectories(uris);
            await showInEditor(markdown);
            this.logger.info('エディタに出力しました');
        } catch (error) {
            this.logger.error(error instanceof Error ? error.message : String(error));
        }
    }

    private async processToClipboard(uri?: vscode.Uri): Promise<void> {
        try {
            const uris = uri ? [uri] : await this.getSelectedUris();
            if (!uris.length) {
                throw new Error('ディレクトリまたはファイルが選択されていません');
            }

            const markdown = await this.processDirectories(uris);
            await copyToClipboard(markdown);
            this.logger.info('クリップボードにコピーしました');
        } catch (error) {
            this.logger.error(error instanceof Error ? error.message : String(error));
        }
    }

    private async processToChatGPT(uri?: vscode.Uri): Promise<void> {
        try {
            const uris = uri ? [uri] : await this.getSelectedUris();
            if (!uris.length) {
                throw new Error('ディレクトリまたはファイルが選択されていません');
            }

            const markdown = await this.processDirectories(uris);
            await openInChatGPT(markdown);
            this.logger.info('ChatGPTに送信しました');
        } catch (error) {
            this.logger.error(error instanceof Error ? error.message : String(error));
        }
    }

    private async getSelectedUris(): Promise<vscode.Uri[]> {
        if (!vscode.workspace.workspaceFolders) {
            throw new Error('ワークスペースが開かれていません');
        }

        return await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: true,
            canSelectMany: true,
            openLabel: '選択',
            defaultUri: vscode.workspace.workspaceFolders[0].uri
        }) || [];
    }
} 