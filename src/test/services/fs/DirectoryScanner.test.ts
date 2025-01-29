import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { DirectoryScanner } from '@/services/fs/DirectoryScanner';
import { FileSystemAdapter, FileStats, DirectoryEntry } from '@/services/fs/FileSystemAdapter';
import { ConfigurationService, Configuration } from '@/services/config/ConfigurationService';
import { LoggingService } from '@/services/logging/LoggingService';
import { ErrorService } from '@/errors/services/ErrorService';
import { WorkspaceService } from '@/services/workspace/WorkspaceService';
import { BaseError } from '@/errors/base/BaseError';
import * as path from 'path';

describe('DirectoryScanner Tests', () => {
    let scanner: DirectoryScanner;
    let configStub: sinon.SinonStubbedInstance<ConfigurationService>;
    let loggerStub: sinon.SinonStubbedInstance<LoggingService>;
    let errorStub: sinon.SinonStubbedInstance<ErrorService>;
    let workspaceStub: sinon.SinonStubbedInstance<WorkspaceService>;
    let fsStub: sinon.SinonStubbedInstance<FileSystemAdapter>;
    let sandbox: sinon.SinonSandbox;
    let findFilesStub: sinon.SinonStub;

    const mockFiles = [
        {
            path: '/test/file1.ts',
            relativePath: 'file1.ts',
            size: 100,
            content: 'test content 1',
            language: 'typescript'
        },
        {
            path: '/test/file2.ts',
            relativePath: 'file2.ts',
            size: 200,
            content: 'test content 2',
            language: 'typescript'
        }
    ];

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        configStub = sandbox.createStubInstance(ConfigurationService);
        loggerStub = sandbox.createStubInstance(LoggingService);
        errorStub = sandbox.createStubInstance(ErrorService);
        workspaceStub = sandbox.createStubInstance(WorkspaceService);
        fsStub = sandbox.createStubInstance(FileSystemAdapter);

        const config: Configuration = {
            excludePatterns: ['**/node_modules/**'],
            maxFileSize: 1024 * 1024,
            maxConcurrentFiles: 10,
            batchSize: 2,
            defaultOutputType: 'editor',
            chatGptIntegration: false,
            chatgptBundleId: 'com.openai.chat',
            development: {
                mockChatGPT: false,
                debugLogging: false,
                disableNativeFeatures: false
            }
        };

        configStub.getConfiguration.returns(config);

        workspaceStub.getWorkspaceFolder.resolves({
            uri: vscode.Uri.file('/test'),
            name: 'test',
            index: 0
        });

        fsStub.readDirectory.resolves(mockFiles.map(f => ({
            name: path.basename(f.path),
            path: f.path,
            type: vscode.FileType.File
        })));

        fsStub.readFile.callsFake(async (path: string) => {
            const file = mockFiles.find(f => f.path === path);
            return file ? file.content : '';
        });

        fsStub.exists.resolves(true);

        fsStub.stat.callsFake(async (path: string) => {
            const file = mockFiles.find(f => f.path === path);
            return {
                size: file ? file.size : 0,
                mtime: Date.now()
            } as FileStats;
        });

        findFilesStub = sandbox.stub(vscode.workspace, 'findFiles').resolves(
            mockFiles.map(f => vscode.Uri.file(f.path))
        );

        scanner = new DirectoryScanner(
            configStub,
            loggerStub,
            errorStub,
            workspaceStub,
            fsStub
        );
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('ディレクトリをスキャンして結果を取得', async () => {
        const result = await scanner.scan('/test');
        assert.strictEqual(result.files.length, mockFiles.length, 'ファイル数が一致しません');
        assert.strictEqual(result.totalSize, 300, '合計サイズが一致しません');
    });

    it('バッチサイズに基づいてファイルを処理', async () => {
        const result = await scanner.scan('/test', { batchSize: 1 });
        assert.strictEqual(result.files.length, mockFiles.length, 'ファイル数が一致しません');
    });

    it('大きなファイルをスキップ', async () => {
        const result = await scanner.scan('/test', { maxFileSize: 150 });
        assert.strictEqual(result.files.length, 1, 'スキップ後のファイル数が一致しません');
    });

    it('エラー発生時に適切に処理', async () => {
        const testError = new Error('test error');
        findFilesStub.rejects(testError);

        await assert.rejects(
            () => scanner.scan('/test'),
            (error: unknown) => {
                assert.ok(error instanceof Error, 'エラーの型が正しくありません');
                assert.ok(errorStub.handleError.calledOnce, 'エラーハンドラが呼び出されていません');
                assert.strictEqual((error as Error).message, 'test error', 'エラーメッセージが一致しません');
                return true;
            }
        );
    });

    it('ワークスペース外のディレクトリを拒否', async () => {
        workspaceStub.getWorkspaceFolder.resolves(undefined);

        await assert.rejects(
            () => scanner.scan('/outside'),
            (error: unknown) => {
                assert.ok(error instanceof BaseError, 'エラーの型が正しくありません');
                assert.ok(errorStub.handleError.calledOnce, 'エラーハンドラが呼び出されていません');
                return true;
            }
        );
    });
}); 
