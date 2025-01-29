import * as vscode from 'vscode';
import { LoggingService } from '@/services/logging/LoggingService';
import { ErrorService } from '@/errors/services/ErrorService';
import { BaseError } from '@/errors/base/BaseError';
import type { ErrorContext } from '@/types';

export class WorkspaceService {
    private static instance: WorkspaceService;
    private readonly logger: LoggingService;
    private readonly errorService: ErrorService;

    private constructor() {
        this.logger = LoggingService.getInstance();
        this.errorService = ErrorService.getInstance();
    }

    static getInstance(): WorkspaceService {
        if (!WorkspaceService.instance) {
            WorkspaceService.instance = new WorkspaceService();
        }
        return WorkspaceService.instance;
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
            await this.errorService.handleError(
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
            await this.errorService.handleError(
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
            await this.errorService.handleError(
                error instanceof Error ? error : new BaseError(String(error), 'UnknownError'),
                context
            );
            return false;
        }
    }
} 