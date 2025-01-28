import * as assert from 'assert';
import * as vscode from 'vscode';
import { DirectoryScanner } from '../extension';
import { ScanError } from '../errors/ScanError';
import { ChatGPTIntegrationError } from '../errors/ChatGPTErrors';
import { ErrorReporter, ErrorLog } from '../services/ErrorReporter';
import { EventEmitter } from 'events';
import { Dirent } from 'fs';

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
    const mockContext = {
        subscriptions: [],
        globalState: {
            get: () => ({
                message: 'Test error',
                code: 'TEST_ERROR',
                timestamp: new Date().toISOString(),
                extensionVersion: '1.0.0'
            } as ErrorLog),
            update: () => Promise.resolve()
        },
        extension: {
            packageJSON: { version: '1.0.0' }
        }
    } as unknown as vscode.ExtensionContext;

    test('ファイルシステムエラーの処理', async () => {
        const mockFiles = {
            '/test/path/error.txt': {
                error: new Error('Permission denied')
            }
        };
        
        const fsAdapter = new EnhancedMockFSAdapter(mockFiles);
        const scanner = new DirectoryScanner(fsAdapter);

        await assert.rejects(
            () => scanner.scan('/test/path'),
            (error: any) => {
                assert.ok(error instanceof ScanError);
                assert.ok(error.message.includes('Permission denied'));
                return true;
            }
        );
    });

    test('メモリ不足エラーの処理', async () => {
        const mockFiles = {
            '/test/path/large.txt': {
                content: 'x'.repeat(1024 * 1024 * 100) // 100MB
            }
        };
        
        const fsAdapter = new EnhancedMockFSAdapter(mockFiles);
        const scanner = new DirectoryScanner(fsAdapter);

        await assert.rejects(
            () => scanner.scan('/test/path'),
            (error: any) => {
                assert.ok(error instanceof Error);
                assert.ok(error.message.includes('memory'));
                return true;
            }
        );
    });

    test('キャンセル時のリソース解放', async () => {
        const mockFiles = {
            '/test/path/test.txt': {
                content: 'test content'
            }
        };
        
        const fsAdapter = new EnhancedMockFSAdapter(mockFiles);
        const scanner = new DirectoryScanner(fsAdapter);
        
        const cancellationToken = new vscode.CancellationTokenSource();
        const scanPromise = scanner.scan('/test/path');
        
        // スキャン開始直後にキャンセル
        cancellationToken.cancel();
        
        await assert.rejects(
            () => scanPromise,
            (error: any) => {
                assert.ok(error instanceof Error);
                assert.ok(error.message.includes('cancelled'));
                return true;
            }
        );
    });

    test('エラーレポートの生成と保存', async () => {
        const reporter = new ErrorReporter(mockContext);
        const testError = new Error('Test error');
        const metadata = {
            code: 'TEST_ERROR',
            file: '/test/path/file.txt'
        };

        await reporter.report(testError, metadata);

        const savedError = await mockContext.globalState.get('lastError') as ErrorLog;
        assert.ok(savedError);
        assert.strictEqual(savedError.message, 'Test error');
        assert.strictEqual(savedError.code, 'TEST_ERROR');
        assert.ok(savedError.timestamp);
        assert.strictEqual(savedError.extensionVersion, '1.0.0');
    });

    test('シンボリックリンクの処理', async () => {
        const mockFiles = {
            '/test/path/link': {
                isSymlink: true,
                target: '/other/path'
            }
        };
        
        const fsAdapter = new EnhancedMockFSAdapter(mockFiles);
        const scanner = new DirectoryScanner(fsAdapter);

        const result = await scanner.scan('/test/path');
        assert.strictEqual(result.length, 0);
    });

    test('無効なファイルパスの処理', async () => {
        const fsAdapter = new EnhancedMockFSAdapter({});
        const scanner = new DirectoryScanner(fsAdapter);

        await assert.rejects(
            () => scanner.scan('invalid/path'),
            ScanError
        );
    });

    test('ChatGPT統合エラーの処理', async () => {
        const mockFiles = {
            '/test/path/test.txt': {
                content: 'test content'
            }
        };
        
        const fsAdapter = new EnhancedMockFSAdapter(mockFiles);
        const scanner = new DirectoryScanner(fsAdapter);

        // ChatGPTアプリが起動していない状態をシミュレート
        process.env.CHATGPT_NOT_RUNNING = 'true';

        await assert.rejects(
            () => scanner.scan('/test/path'),
            (error: any) => {
                assert.ok(error instanceof ChatGPTIntegrationError);
                assert.ok(error.message.includes('ChatGPT'));
                return true;
            }
        );

        delete process.env.CHATGPT_NOT_RUNNING;
    });

    test('バッチ処理のエラー回復', async () => {
        const mockFiles = {
            '/test/path/good.txt': {
                content: 'good content'
            },
            '/test/path/bad.txt': {
                error: new Error('Read error')
            },
            '/test/path/also-good.txt': {
                content: 'more content'
            }
        };
        
        const fsAdapter = new EnhancedMockFSAdapter(mockFiles);
        const scanner = new DirectoryScanner(fsAdapter);

        const result = await scanner.scan('/test/path');
        
        // エラーが発生したファイルをスキップし、他のファイルは処理できていることを確認
        assert.strictEqual(result.length, 2);
        assert.ok(result.some(item => item.path.includes('good.txt')));
        assert.ok(result.some(item => item.path.includes('also-good.txt')));
    });

    test('並列処理中のエラー処理', async () => {
        const mockFiles = {
            '/test/path/1.txt': {
                content: 'content 1'
            },
            '/test/path/2.txt': {
                error: new Error('Parallel error 1')
            },
            '/test/path/3.txt': {
                error: new Error('Parallel error 2')
            },
            '/test/path/4.txt': {
                content: 'content 4'
            }
        };
        
        const fsAdapter = new EnhancedMockFSAdapter(mockFiles);
        const errors: Error[] = [];
        fsAdapter.on('error', (error: Error) => {
            errors.push(error);
        });

        const scanner = new DirectoryScanner(fsAdapter, undefined, {
            maxConcurrency: 4,
            batchSize: 100,
            excludePatterns: []
        });
        const result = await scanner.scan('/test/path');
        
        // エラーが発生したが、処理は継続されていることを確認
        assert.strictEqual(errors.length, 2);
        assert.strictEqual(result.length, 2);
    });
}); 
