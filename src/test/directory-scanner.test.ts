import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { DirectoryScanner } from '../services/directory-scanner';
import { MockFSAdapter, FileStats } from '../services/fs-adapter';
import { ConfigurationManager } from '../services/configuration-manager';
import { Configuration } from '../services/configuration-manager';
import { I18n } from '../services/i18n';

suite('DirectoryScanner Tests', () => {
    let scanner: DirectoryScanner;
    let fsAdapter: MockFSAdapter;
    let config: ConfigurationManager;
    let i18n: I18n;
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
        fsAdapter = new MockFSAdapter();
        config = ConfigurationManager.getInstance();
        i18n = new I18n();
        scanner = new DirectoryScanner(fsAdapter);

        // FSAdapterのスタブ設定
        sandbox.stub(fsAdapter, 'readFile').resolves('test content');
        sandbox.stub(fsAdapter, 'stat').resolves({
            isDirectory: () => false,
            isSymbolicLink: () => false,
            size: 1024
        } as FileStats);
        sandbox.stub(fsAdapter, 'findFiles').resolves([
            '/test/path/file1.ts',
            '/test/path/file2.js',
            '/test/path/file3.json'
        ]);

        // ConfigurationManagerのスタブ設定
        const mockConfig: Configuration = {
            excludePatterns: [
                '**/node_modules/**',
                '**/dist/**'
            ],
            maxFileSize: 1024 * 1024,
            maxConcurrentFiles: 10,
            defaultOutputType: 'editor',
            chatGptIntegration: false,
            batchSize: 100
        };
        sandbox.stub(config, 'getConfiguration').returns(mockConfig);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('ディレクトリをスキャンして結果を取得', async () => {
        const results = await scanner.scan('/test/path');

        assert.ok(Array.isArray(results));
        assert.strictEqual(results.length, 3);
        assert.ok((fsAdapter.findFiles as sinon.SinonStub).called);
        assert.ok((fsAdapter.readFile as sinon.SinonStub).called);
    });

    test('設定に基づいてファイルをフィルタリング', async () => {
        (fsAdapter.findFiles as sinon.SinonStub).resolves([
            '/test/path/file1.ts',
            '/test/path/node_modules/file2.js',
            '/test/path/dist/file3.json'
        ]);

        const results = await scanner.scan('/test/path');

        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].path, '/test/path/file1.ts');
    });

    test('ファイル読み込みエラーの処理', async function() {
        this.timeout(5000);
        const errorMessage = i18n.t('errors.fileSystem');
        const error = new Error(errorMessage);
        (fsAdapter.readFile as sinon.SinonStub).rejects(error);

        try {
            await scanner.scan('/test/path');
            assert.fail('Error scanning directory: ' + errorMessage);
        } catch (e: any) {
            assert.ok(e instanceof Error);
            assert.strictEqual(e.message, `Error scanning directory: ${errorMessage}`);
        }
    });

    test('ファイル検索エラーの処理', async () => {
        const errorMessage = i18n.t('errors.fileSystem');
        const error = new Error(errorMessage);
        (fsAdapter.findFiles as sinon.SinonStub).rejects(error);

        try {
            await scanner.scan('/test/path');
            assert.fail('エラーが発生するはずです');
        } catch (e: any) {
            assert.ok(e instanceof Error);
            assert.strictEqual(e.message, `Error scanning directory: ${errorMessage}`);
        }
    });

    test('空のディレクトリの処理', async () => {
        (fsAdapter.findFiles as sinon.SinonStub).resolves([]);

        const results = await scanner.scan('/test/path');

        assert.strictEqual(results.length, 0);
    });

    test('設定の変更を検知', () => {
        const mockDisposable = {
            dispose: () => {}
        };
        sandbox.stub(vscode.workspace, 'onDidChangeConfiguration').returns(mockDisposable);
        
        const disposable = (scanner as any).watchConfiguration();
        assert.ok(disposable === mockDisposable);
        disposable.dispose();
    });

    test('大きなファイルの処理', async () => {
        const largeContent = 'x'.repeat(1024 * 1024); // 1MB
        (fsAdapter.readFile as sinon.SinonStub).resolves(largeContent);
        (fsAdapter.findFiles as sinon.SinonStub).resolves(['/test/path/large-file.ts']);

        const results = await scanner.scan('/test/path');

        assert.strictEqual(results.length, 1);
        assert.ok(results[0].content.length === largeContent.length);
    });
}); 
