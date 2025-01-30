import * as assert from 'assert';
import * as vscode from 'vscode';
import { DirectoryScanner } from '../../../domain/files/DirectoryScanner';
import { IConfigurationService, Configuration } from '../../../infrastructure/config/ConfigurationService';
import { II18nService } from '../../../i18n/I18nService';
import * as sinon from 'sinon';
import { FileSystemAdapter, FileStats, IFileSystem, DirectoryEntry } from '../../../domain/files/FileSystemAdapter';
import { expect } from 'chai';
import { IErrorHandler } from '../../../shared/errors/services/ErrorService';
import { ILogger } from '../../../infrastructure/logging/LoggingService';
import { IWorkspaceService } from '../../../domain/workspace/WorkspaceService';
import { IFileTypeService } from '../../../domain/files/FileTypeService';

describe('パフォーマンステスト', () => {
    let scanner: DirectoryScanner;
    let sandbox: sinon.SinonSandbox;
    let fsAdapter: IFileSystem;
    let configServiceStub: IConfigurationService;
    let loggerStub: ILogger;
    let errorHandlerStub: IErrorHandler;
    let workspaceServiceStub: IWorkspaceService;
    let fileTypeServiceStub: IFileTypeService;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // FileSystemAdapterのスタブ化
        fsAdapter = {
            readFile: sandbox.stub<[string], Promise<string>>().resolves('test content'),
            writeFile: sandbox.stub<[string, string], Promise<void>>().resolves(),
            readDirectory: sandbox.stub<[string], Promise<DirectoryEntry[]>>().resolves([
                { name: 'file1.ts', type: vscode.FileType.File },
                { name: 'file2.js', type: vscode.FileType.File }
            ]),
            stat: sandbox.stub<[string], Promise<FileStats>>().resolves({
                size: 1024,
                mtime: Date.now()
            } as FileStats),
            exists: sandbox.stub<[string], Promise<boolean>>().resolves(true),
            createDirectory: sandbox.stub<[string], Promise<void>>().resolves(),
            delete: sandbox.stub<[string, { recursive?: boolean }?], Promise<void>>().resolves(),
            copy: sandbox.stub<[string, string, { overwrite?: boolean }?], Promise<void>>().resolves()
        };

        // ConfigurationServiceのスタブ化
        configServiceStub = {
            getConfiguration: sandbox.stub().returns({
                excludePatterns: ['**/node_modules/**'],
                maxFileSize: 1024 * 1024,
                maxConcurrentFiles: 10,
                batchSize: 50,
                defaultOutputType: 'editor',
                chatGptIntegration: false,
                development: {
                    mockChatGPT: false,
                    debugLogging: false,
                    disableNativeFeatures: false
                }
            }),
            addChangeListener: sandbox.stub(),
            removeChangeListener: sandbox.stub()
        };

        // LoggerServiceのスタブ化
        loggerStub = {
            debug: sandbox.stub(),
            info: sandbox.stub(),
            warn: sandbox.stub(),
            error: sandbox.stub(),
            show: sandbox.stub(),
            dispose: sandbox.stub()
        };

        // ErrorHandlerのスタブ化
        errorHandlerStub = {
            handleError: sandbox.stub().resolves(),
            getErrorLogs: sandbox.stub().returns([]),
            clearErrorLogs: sandbox.stub()
        };

        // WorkspaceServiceのスタブ化
        workspaceServiceStub = {
            validateWorkspacePath: sandbox.stub().resolves(true),
            getWorkspacePath: sandbox.stub().returns('/test/workspace'),
            onWorkspaceChange: sandbox.stub().returns({ dispose: () => {} }),
            getWorkspaceFolder: sandbox.stub().resolves({
                uri: vscode.Uri.file('/test/workspace'),
                name: 'test',
                index: 0
            }),
            selectWorkspaceFolder: sandbox.stub().resolves({
                uri: vscode.Uri.file('/test/workspace'),
                name: 'test',
                index: 0
            })
        };

        // FileTypeServiceのスタブ化
        fileTypeServiceStub = {
            isTextFile: sandbox.stub().returns(true),
            getFileType: sandbox.stub().returns({ languageId: 'typescript', typeName: 'TypeScript' }),
            isKnownType: sandbox.stub().returns(true),
            getSupportedExtensions: sandbox.stub().returns(['.ts', '.js']),
            addTextFileExtension: sandbox.stub(),
            removeTextFileExtension: sandbox.stub(),
            getTextFileExtensions: sandbox.stub().returns(['.ts', '.js'])
        };

        // DirectoryScannerの初期化
        scanner = new DirectoryScanner(
            configServiceStub,
            loggerStub,
            errorHandlerStub,
            workspaceServiceStub,
            fileTypeServiceStub,
            fsAdapter
        );
    });

    afterEach(() => {
        sandbox.restore();
    });

    // 一時的にスキップ: パフォーマンス改善後に再度有効化する
    it.skip('大量のファイルを効率的に処理できる', async function() {
        this.timeout(30000);
        // テストの実装
    });

    // 一時的にスキップ: パフォーマンス改善後に再度有効化する
    it.skip('メモリ使用量を制御できる', async function() {
        this.timeout(30000);
        // テストの実装
    });
}); 
