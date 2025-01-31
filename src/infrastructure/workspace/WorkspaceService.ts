import * as vscode from 'vscode';
import { ILogger } from '../logging/LoggingService';
import { IErrorHandler } from '../../shared/errors/services/ErrorService';
import { MatomeruError, ErrorCode, ErrorContext } from '../../shared/errors/MatomeruError';

export interface IWorkspaceService {
    validateWorkspacePath(path: string): Promise<boolean>;
    getWorkspacePath(): string | undefined;
    onWorkspaceChange(listener: () => void): vscode.Disposable;
    getWorkspaceFolder(filePath: string): Promise<vscode.WorkspaceFolder | undefined>;
    getCurrentWorkspaceFolder(): Promise<vscode.WorkspaceFolder>;
    getWorkspaceFolders(): Promise<readonly vscode.WorkspaceFolder[]>;
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
     * 指定されたファイルパスに対応するワークスペースフォルダを取得
     */
    async getWorkspaceFolder(filePath: string): Promise<vscode.WorkspaceFolder | undefined> {
        try {
            const uri = vscode.Uri.file(filePath);
            return vscode.workspace.getWorkspaceFolder(uri);
        } catch (error) {
            const matomeruError = new MatomeruError(
                'ワークスペースフォルダの取得に失敗しました',
                ErrorCode.WORKSPACE_ERROR,
                {
                    source: 'WorkspaceService.getWorkspaceFolder',
                    details: {
                        filePath,
                        error: error instanceof Error ? error.message : String(error)
                    },
                    timestamp: new Date()
                }
            );
            
            await this.errorHandler.handleError(matomeruError);
            throw matomeruError;
        }
    }

    /**
     * 現在のワークスペースフォルダを取得
     */
    async getCurrentWorkspaceFolder(): Promise<vscode.WorkspaceFolder> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new MatomeruError(
                    'ワークスペースが開かれていません',
                    ErrorCode.WORKSPACE_ERROR,
                    {
                        source: 'WorkspaceService.getCurrentWorkspaceFolder',
                        timestamp: new Date()
                    }
                );
            }

            return workspaceFolders[0];
        } catch (error) {
            if (error instanceof MatomeruError) {
                throw error;
            }
            throw new MatomeruError(
                'ワークスペースフォルダの取得に失敗しました',
                ErrorCode.WORKSPACE_ERROR,
                {
                    source: 'WorkspaceService.getCurrentWorkspaceFolder',
                    details: {
                        error: error instanceof Error ? error.message : String(error)
                    },
                    timestamp: new Date()
                }
            );
        }
    }

    /**
     * すべてのワークスペースフォルダを取得
     */
    async getWorkspaceFolders(): Promise<readonly vscode.WorkspaceFolder[]> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new MatomeruError(
                    'ワークスペースが開かれていません',
                    ErrorCode.WORKSPACE_ERROR,
                    {
                        source: 'WorkspaceService.getWorkspaceFolders',
                        timestamp: new Date()
                    }
                );
            }

            return workspaceFolders;
        } catch (error) {
            if (error instanceof MatomeruError) {
                throw error;
            }
            throw new MatomeruError(
                'ワークスペースフォルダの取得に失敗しました',
                ErrorCode.WORKSPACE_ERROR,
                {
                    source: 'WorkspaceService.getWorkspaceFolders',
                    details: {
                        error: error instanceof Error ? error.message : String(error)
                    },
                    timestamp: new Date()
                }
            );
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
            const matomeruError = new MatomeruError(
                'ワークスペースフォルダの選択に失敗しました',
                ErrorCode.WORKSPACE_ERROR,
                {
                    source: 'WorkspaceService.selectWorkspaceFolder',
                    details: {
                        error: error instanceof Error ? error.message : String(error)
                    },
                    timestamp: new Date()
                }
            );
            
            await this.errorHandler.handleError(matomeruError);
            throw matomeruError;
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
            const matomeruError = new MatomeruError(
                'ワークスペースパスの検証に失敗しました',
                ErrorCode.WORKSPACE_ERROR,
                {
                    source: 'WorkspaceService.validateWorkspacePath',
                    details: {
                        path,
                        error: error instanceof Error ? error.message : String(error)
                    },
                    timestamp: new Date()
                }
            );
            
            await this.errorHandler.handleError(matomeruError);
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