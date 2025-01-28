import * as assert from 'assert';
import * as vscode from 'vscode';
import { DirectoryScanner } from '../services/directory-scanner';
import { FSAdapter, MockFSAdapter } from '../services/fs-adapter';
import { ScanError } from '../errors/ScanError';
import { ChatGPTIntegrationError, UnsupportedPlatformError } from '../errors/ChatGPTErrors';
import { EventEmitter } from 'events';
import { Dirent } from 'fs';
import * as sinon from 'sinon';
import { ErrorService } from '../services/error/ErrorService';
import { ErrorContext } from '../types';
import { I18n } from '../i18n';

interface MockFile {
    content?: string;
    error?: Error;
    isSymlink?: boolean;
    target?: string;
}

interface FileSystemAdapter {
    readdir(path: string): Promise<Dirent[]>;
    readFile(path: string): Promise<string>;
    isSymlink?(path: string): Promise<boolean>;
}

class EnhancedMockFSAdapter extends EventEmitter implements FileSystemAdapter {
    constructor(private mockFiles: Record<string, MockFile>) {
        super();
    }

    async readFile(path: string): Promise<string> {
        const file = this.mockFiles[path];
        if (!file) {
            throw new Error(`File not found: ${path}`);
        }
        if (file.error) {
            throw file.error;
        }
        if (file.isSymlink) {
            throw new Error('Symlink not supported');
        }
        return file.content || '';
    }

    async readdir(path: string): Promise<Dirent[]> {
        return Object.keys(this.mockFiles).map(filePath => ({
            name: filePath.split('/').pop() || '',
            isDirectory: () => false,
            isFile: () => true,
            isSymbolicLink: () => false,
            isBlockDevice: () => false,
            isCharacterDevice: () => false,
            isFIFO: () => false,
            isSocket: () => false
        } as Dirent));
    }

    async isSymlink(path: string): Promise<boolean> {
        return !!this.mockFiles[path]?.isSymlink;
    }
}

suite('エラーハンドリングテスト', () => {
    let fsAdapter: MockFSAdapter;
    let scanner: DirectoryScanner;
    let sandbox: sinon.SinonSandbox;
    let errorService: ErrorService;
    let i18n: I18n;

    setup(() => {
        sandbox = sinon.createSandbox();
        fsAdapter = new MockFSAdapter();
        scanner = new DirectoryScanner(fsAdapter);
        errorService = ErrorService.getInstance();
        i18n = I18n.getInstance();
        errorService.clearErrorLog();
    });

    teardown(() => {
        sandbox.restore();
        fsAdapter.clearMocks();
        errorService.clearErrorLog();
    });

    test('ファイルシステムエラーの処理', async function() {
        this.timeout(10000);
        fsAdapter.setMockFile('/test/path/file.txt', '', false, false);
        sandbox.stub(fsAdapter, 'findFiles').resolves(['/test/path/file.txt']);
        const errorMessage = i18n.t('errors.fileSystem');
        const error = new Error(errorMessage);
        sandbox.stub(fsAdapter, 'readFile').rejects(error);
        sandbox.stub(vscode.window, 'showErrorMessage').resolves();

        try {
            await scanner.scan('/test/path', true);
            assert.fail('エラーが発生するはずです');
        } catch (error: any) {
            assert.ok(error instanceof Error);
            assert.strictEqual(error.message, `Error scanning directory: ${errorMessage}`);
            
            const context: ErrorContext = {
                source: 'FileSystem',
                details: { path: '/test/path/file.txt' },
                timestamp: new Date()
            };
            await errorService.handleError(error, context);
            
            const logs = errorService.getErrorLog();
            assert.strictEqual(logs.length, 1);
            assert.strictEqual(logs[0].message, `Error scanning directory: ${errorMessage}`);
        }
    });

    test('メモリ不足エラーの処理', async function() {
        this.timeout(10000);
        const largeString = 'x'.repeat(1024 * 1024);
        fsAdapter.setMockFile('/test/path/large.txt', largeString, false, false);
        sandbox.stub(fsAdapter, 'findFiles').resolves(['/test/path/large.txt']);
        const errorMessage = i18n.t('errors.outOfMemory');
        const error = new Error(errorMessage);
        sandbox.stub(fsAdapter, 'readFile').rejects(error);
        sandbox.stub(vscode.window, 'showErrorMessage').resolves();

        try {
            await scanner.scan('/test/path', true);
            assert.fail('エラーが発生するはずです');
        } catch (error: any) {
            assert.ok(error instanceof Error);
            assert.strictEqual(error.message, `Error scanning directory: ${errorMessage}`);
            
            const context: ErrorContext = {
                source: 'MemoryManager',
                details: { fileSize: '1MB' },
                timestamp: new Date()
            };
            await errorService.handleError(error, context);
            
            const logs = errorService.getErrorLog();
            assert.strictEqual(logs.length, 1);
            assert.strictEqual(logs[0].message, `Error scanning directory: ${errorMessage}`);
        }
    });

    test('シンボリックリンクの処理', async () => {
        fsAdapter.setMockFile('/test/path/symlink', '', false, true);
        sandbox.stub(fsAdapter, 'findFiles').resolves(['/test/path/symlink']);

        const result = await scanner.scan('/test/path');
        assert.strictEqual(result.length, 0);
    });

    test('無効なファイルパスの処理', async () => {
        const error = new Error('無効なパス');
        sandbox.stub(fsAdapter, 'findFiles').rejects(error);

        try {
            await scanner.scan('/invalid/path', true);
            assert.fail('エラーが発生するはずです');
        } catch (error: any) {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('無効なパス'));
        }
    });

    test('並列処理中のエラー処理', async () => {
        fsAdapter.setMockFile('/test/path/good.txt', 'good content', false, false);
        fsAdapter.setMockFile('/test/path/bad.txt', '', false, false);
        fsAdapter.setMockFile('/test/path/also-good.txt', 'also good content', false, false);
        sandbox.stub(fsAdapter, 'findFiles').resolves([
            '/test/path/good.txt',
            '/test/path/bad.txt',
            '/test/path/also-good.txt'
        ]);

        const readFileStub = sandbox.stub(fsAdapter, 'readFile');
        readFileStub.callsFake(async (path: string) => {
            if (path.includes('bad.txt')) {
                throw new Error('ファイル読み込みエラー');
            }
            return path.includes('good.txt') ? 'good content' : 'also good content';
        });

        const result = await scanner.scan('/test/path');
        assert.ok(result.some(item => item.path.includes('good.txt')));
        assert.ok(result.some(item => item.path.includes('also-good.txt')));
        assert.ok(!result.some(item => item.path.includes('bad.txt')));
    });
});

suite('ErrorService Test Suite', () => {
    let errorService: ErrorService;
    let sandbox: sinon.SinonSandbox;
    let mockWindow: any;

    setup(() => {
        sandbox = sinon.createSandbox();
        errorService = ErrorService.getInstance();
        errorService.clearErrorLog();
        
        // VSCodeのウィンドウAPIをモック
        mockWindow = {
            showErrorMessage: sandbox.stub().resolves(),
            showInformationMessage: sandbox.stub().resolves(),
            showWarningMessage: sandbox.stub().resolves()
        };
        sandbox.stub(vscode.window, 'showErrorMessage').callsFake(mockWindow.showErrorMessage);
        sandbox.stub(vscode.window, 'showInformationMessage').callsFake(mockWindow.showInformationMessage);
        sandbox.stub(vscode.window, 'showWarningMessage').callsFake(mockWindow.showWarningMessage);
    });

    teardown(() => {
        sandbox.restore();
        errorService.clearErrorLog();
    });

    test('エラーログの基本的な記録と取得', async function() {
        this.timeout(5000);
        const error = new Error('テストエラー');
        const context: ErrorContext = {
            source: 'TestSource',
            details: { testKey: 'testValue' },
            timestamp: new Date()
        };
        await errorService.handleError(error, context);

        const logs = errorService.getErrorLog();
        assert.strictEqual(logs.length, 1);
        assert.strictEqual(logs[0].message, 'テストエラー');
        assert.strictEqual(logs[0].source, 'TestSource');
        assert.deepStrictEqual(logs[0].details, { testKey: 'testValue' });
        assert.ok(mockWindow.showErrorMessage.called);
    });

    test('カスタムエラータイプの処理', async function() {
        this.timeout(5000);
        const error = new UnsupportedPlatformError('macOSのみ対応しています');
        const context: ErrorContext = {
            source: 'PlatformCheck',
            timestamp: new Date()
        };
        await errorService.handleError(error, context);

        const logs = errorService.getErrorLog();
        assert.strictEqual(logs.length, 1);
        assert.strictEqual(logs[0].type, 'UnsupportedPlatformError');
        assert.ok(mockWindow.showErrorMessage.called);
    });

    test('エラーログのクリア', () => {
        const error = new Error('テストエラー');
        const context: ErrorContext = {
            source: 'TestSource',
            timestamp: new Date()
        };
        errorService.handleError(error, context);
        
        assert.strictEqual(errorService.getErrorLog().length, 1);
        
        errorService.clearErrorLog();
        assert.strictEqual(errorService.getErrorLog().length, 0);
    });

    test('スタックトレースの記録', async function() {
        this.timeout(5000);
        const error = new Error('スタックトレースのテスト');
        Error.captureStackTrace(error);
        const context: ErrorContext = {
            source: 'StackTest',
            timestamp: new Date()
        };
        
        await errorService.handleError(error, context);
        
        const logs = errorService.getErrorLog();
        assert.ok(logs[0].stack, 'スタックトレースが記録されていません');
        assert.ok(logs[0].stack.includes('Error: スタックトレースのテスト'));
    });
});

// 既存のDirectoryScannerのテストスイートは維持
suite('DirectoryScanner Test Suite', () => {
    // ... existing code ...
}); 
