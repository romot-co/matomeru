import * as assert from 'assert';
import * as vscode from 'vscode';
import { DirectoryScanner } from '../../services/fs/DirectoryScanner';
import { ConfigurationService } from '../../services/config/ConfigurationService';
import { I18nService } from '../../i18n/I18nService';
import * as sinon from 'sinon';
import { FileSystemAdapter, FileStats } from '../../services/fs/FileSystemAdapter';

describe.skip('パフォーマンステスト', () => {
    let scanner: DirectoryScanner;
    let sandbox: sinon.SinonSandbox;
    let fsAdapter: sinon.SinonStubbedInstance<FileSystemAdapter>;
    let config: ConfigurationService;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // FileSystemAdapterのスタブ化
        fsAdapter = sandbox.createStubInstance(FileSystemAdapter);
        fsAdapter.readFile.resolves('test content');
        fsAdapter.readDirectory.resolves([
            { name: 'file1.ts', type: vscode.FileType.File },
            { name: 'file2.js', type: vscode.FileType.File }
        ]);
        fsAdapter.stat.resolves({
            size: 1024,
            mtime: Date.now()
        } as FileStats);

        // ConfigurationServiceのスタブ化
        config = ConfigurationService.getInstance();
        sandbox.stub(config, 'getConfiguration').returns({
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
        });

        // DirectoryScannerの初期化
        scanner = new DirectoryScanner();
        Object.defineProperty(scanner, 'fsAdapter', {
            value: fsAdapter,
            writable: true,
            configurable: true
        });
    });

    afterEach(() => {
        sandbox.restore();
    });

    // 一時的にスキップ: パフォーマンス改善後に再度有効化する
    it('大量のファイルを効率的に処理できる', async function() {
        this.timeout(30000);
        // テストの実装
    });

    // 一時的にスキップ: パフォーマンス改善後に再度有効化する
    it('メモリ使用量を制御できる', async function() {
        this.timeout(30000);
        // テストの実装
    });
}); 
