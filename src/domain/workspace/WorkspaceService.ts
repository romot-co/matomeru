import * as vscode from 'vscode';
import { ILogger } from '../../infrastructure/logging/LoggingService';
import { IErrorHandler } from '../../shared/errors/services/ErrorService';
import { BaseError } from '../../shared/errors/base/BaseError';
import type { ErrorContext } from '../../types';

export interface IWorkspaceService {
    validateWorkspacePath(path: string): Promise<boolean>;
    getWorkspacePath(): string | undefined;
    onWorkspaceChange(listener: () => void): vscode.Disposable;
    getWorkspaceFolder(path: string): Promise<vscode.WorkspaceFolder | undefined>;
    selectWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined>;
}

/**
 * ワークスペース管理サービス
 * VS Code のワークスペース関連の機能を提供します
 */
export class WorkspaceService implements IWorkspaceService {
    constructor(
        private readonly logger: ILogger,
        private readonly errorHandler: IErrorHandler
    ) {}

    /**
     * ファクトリメソッド - デフォルトの設定でWorkspaceServiceインスタンスを生成
     */
    public static createDefault(logger: ILogger, errorHandler: IErrorHandler): WorkspaceService {
        return new WorkspaceService(logger, errorHandler);
    }

    /**
     * 指定されたパスが属するワークスペースフォルダを取得
     */
    async getWorkspaceFolder(path: string): Promise<vscode.WorkspaceFolder | undefined> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                this.logger.warn('No workspace folders available', {
                    source: 'WorkspaceService.getWorkspaceFolder'
                });
                return undefined;
            }

            const folder = workspaceFolders.find(f => path.startsWith(f.uri.fsPath));
            if (!folder) {
                this.logger.warn('Path is not in any workspace folder', {
                    source: 'WorkspaceService.getWorkspaceFolder',
                    details: { path }
                });
            }

            return folder;
        } catch (error) {
            const context: ErrorContext = {
                source: 'WorkspaceService.getWorkspaceFolder',
                details: { path },
                timestamp: new Date()
            };
            await this.errorHandler.handleError(
                error instanceof Error ? error : new BaseError(String(error), 'UnknownError'),
                context
            );
            throw error;
        }
    }

    /**
     * 複数ワークスペースが存在する場合、ユーザーに選択を促す
     */
    async selectWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                this.logger.warn('No workspace folders available', {
                    source: 'WorkspaceService.selectWorkspaceFolder'
                });
                return undefined;
            }

            if (workspaceFolders.length === 1) {
                return workspaceFolders[0];
            }

            const selected = await vscode.window.showQuickPick(
                workspaceFolders.map(folder => ({
                    label: folder.name,
                    description: folder.uri.fsPath,
                    folder
                })),
                {
                    placeHolder: 'Select workspace folder'
                }
            );

            return selected?.folder;
        } catch (error) {
            const context: ErrorContext = {
                source: 'WorkspaceService.selectWorkspaceFolder',
                timestamp: new Date()
            };
            await this.errorHandler.handleError(
                error instanceof Error ? error : new BaseError(String(error), 'UnknownError'),
                context
            );
            throw error;
        }
    }

    /**
     * パスがワークスペース内にあるか検証
     */
    async validateWorkspacePath(path: string): Promise<boolean> {
        try {
            const folder = await this.getWorkspaceFolder(path);
            return folder !== undefined;
        } catch (error) {
            const context: ErrorContext = {
                source: 'WorkspaceService.validateWorkspacePath',
                details: { path },
                timestamp: new Date()
            };
            await this.errorHandler.handleError(
                error instanceof Error ? error : new BaseError(String(error), 'UnknownError'),
                context
            );
            return false;
        }
    }

    getWorkspacePath(): string | undefined {
        const folders = vscode.workspace.workspaceFolders;
        return folders?.[0]?.uri.fsPath;
    }

    onWorkspaceChange(listener: () => void): vscode.Disposable {
        return vscode.workspace.onDidChangeWorkspaceFolders(listener);
    }
} 