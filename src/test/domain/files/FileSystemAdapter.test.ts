import * as vscode from 'vscode';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { FileSystemAdapter } from '../../../domain/files/FileSystemAdapter';
import { IErrorHandler } from '../../../shared/errors/services/ErrorService';
import { ILogger } from '../../../infrastructure/logging/LoggingService';
import { BaseError } from '../../../shared/errors/base/BaseError';
import * as path from 'path';

describe('FileSystemAdapter', () => {
    let adapter: FileSystemAdapter;
    let sandbox: sinon.SinonSandbox;
    let errorHandlerStub: IErrorHandler & { handleError: sinon.SinonStub };
    let loggerStub: ILogger;
    let fsStub: {
        readFile: sinon.SinonStub;
        writeFile: sinon.SinonStub;
        readDirectory: sinon.SinonStub;
        stat: sinon.SinonStub;
        createDirectory: sinon.SinonStub;
        delete: sinon.SinonStub;
        copy: sinon.SinonStub;
        rename: sinon.SinonStub;
        isWritableFileSystem: boolean;
    };

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // エラーハンドラーのスタブを作成
        errorHandlerStub = {
            handleError: sandbox.stub().resolves(),
            getErrorLogs: sandbox.stub().returns([]),
            clearErrorLogs: sandbox.stub()
        } as IErrorHandler & { handleError: sinon.SinonStub };

        // ロガーのスタブを作成
        loggerStub = {
            info: sandbox.stub(),
            warn: sandbox.stub(),
            error: sandbox.stub(),
            debug: sandbox.stub(),
            show: sandbox.stub(),
            dispose: sandbox.stub()
        };

        // VSCode FSのスタブを作成
        fsStub = {
            readFile: sandbox.stub(),
            writeFile: sandbox.stub(),
            readDirectory: sandbox.stub(),
            stat: sandbox.stub(),
            createDirectory: sandbox.stub(),
            delete: sandbox.stub(),
            copy: sandbox.stub(),
            rename: sandbox.stub(),
            isWritableFileSystem: true
        };

        // FileSystemAdapterの初期化
        adapter = new FileSystemAdapter(errorHandlerStub, loggerStub);
        Object.defineProperty(vscode.workspace, 'fs', {
            value: fsStub,
            configurable: true,
            writable: true
        });
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('readFile', () => {
        it('ファイルを正常に読み込む', async () => {
            const content = 'test content';
            fsStub.stat.resolves({
                type: vscode.FileType.File,
                ctime: Date.now(),
                mtime: Date.now(),
                size: 100
            });
            fsStub.readFile.resolves(Buffer.from(content));

            const result = await adapter.readFile('/test/path');
            expect(result).to.equal(content);
            expect(fsStub.readFile.calledOnce).to.be.true;
            sinon.assert.notCalled(errorHandlerStub.handleError);
        });

        it('エラー時に適切に処理する', async () => {
            const error = new Error('Read error');
            fsStub.stat.resolves({
                type: vscode.FileType.File,
                ctime: Date.now(),
                mtime: Date.now(),
                size: 100
            });
            fsStub.readFile.rejects(error);

            try {
                await adapter.readFile('/test/path');
                expect.fail('エラーが発生するはずです');
            } catch (err) {
                const baseError = err as BaseError;
                expect(baseError).to.be.instanceOf(BaseError);
                expect(baseError.message).to.equal('ファイルの読み込みに失敗しました');
                expect(baseError.code).to.equal('FileSystemError');
                expect(baseError.details).to.deep.include({
                    operation: 'readFile',
                    path: '/test/path',
                    originalError: 'Read error'
                });
                sinon.assert.called(errorHandlerStub.handleError);
            }
        });
    });

    describe('writeFile', () => {
        it('ファイルを正常に書き込む', async () => {
            fsStub.writeFile.resolves();

            await adapter.writeFile('/test/path', 'test content');
            expect(fsStub.writeFile.calledOnce).to.be.true;
            sinon.assert.notCalled(errorHandlerStub.handleError);
        });

        it('エラー時に適切に処理する', async () => {
            const error = new Error('Write error');
            fsStub.writeFile.rejects(error);

            try {
                await adapter.writeFile('/test/path', 'test content');
                expect.fail('エラーが発生するはずです');
            } catch (err) {
                const baseError = err as BaseError;
                expect(baseError).to.be.instanceOf(BaseError);
                expect(baseError.message).to.equal('ファイルの書き込みに失敗しました');
                expect(baseError.code).to.equal('FileSystemError');
                expect(baseError.details).to.deep.include({
                    operation: 'writeFile',
                    path: '/test/path',
                    error: 'Write error'
                });
                sinon.assert.calledOnce(errorHandlerStub.handleError);
            }
        });
    });

    describe('readDirectory', () => {
        it('ディレクトリの内容を正常に読み込む', async () => {
            const entries: [string, vscode.FileType][] = [
                ['file1.txt', vscode.FileType.File],
                ['dir1', vscode.FileType.Directory]
            ];
            fsStub.readDirectory.resolves(entries);

            const result = await adapter.readDirectory('/test/dir');
            expect(result).to.deep.equal([
                { name: 'file1.txt', type: vscode.FileType.File },
                { name: 'dir1', type: vscode.FileType.Directory }
            ]);
            expect(fsStub.readDirectory.calledOnce).to.be.true;
            sinon.assert.notCalled(errorHandlerStub.handleError);
        });

        it('エラー時に適切に処理する', async () => {
            const error = new Error('Read directory error');
            fsStub.readDirectory.rejects(error);

            try {
                await adapter.readDirectory('/test/dir');
                expect.fail('エラーが発生するはずです');
            } catch (err) {
                const baseError = err as BaseError;
                expect(baseError).to.be.instanceOf(BaseError);
                expect(baseError.message).to.equal('ディレクトリの読み込みに失敗しました');
                expect(baseError.code).to.equal('FileSystemError');
                expect(baseError.details).to.deep.include({
                    operation: 'readDirectory',
                    path: '/test/dir',
                    error: 'Read directory error'
                });
                sinon.assert.calledOnce(errorHandlerStub.handleError);
            }
        });
    });

    describe('exists', () => {
        it('ファイルが存在する場合はtrueを返す', async () => {
            fsStub.stat.resolves({
                type: vscode.FileType.File,
                ctime: Date.now(),
                mtime: Date.now(),
                size: 100
            });

            const result = await adapter.exists('/test/path');
            expect(result).to.be.true;
            expect(fsStub.stat.calledOnce).to.be.true;
        });

        it('ファイルが存在しない場合はfalseを返す', async () => {
            fsStub.stat.rejects(new Error('File not found'));

            const result = await adapter.exists('/test/path');
            expect(result).to.be.false;
            expect(fsStub.stat.calledOnce).to.be.true;
        });
    });

    describe('createDirectory', () => {
        it('ディレクトリを正常に作成する', async () => {
            fsStub.createDirectory.resolves();

            await adapter.createDirectory('/test/dir');
            expect(fsStub.createDirectory.calledOnce).to.be.true;
            sinon.assert.notCalled(errorHandlerStub.handleError);
        });

        it('エラー時に適切に処理する', async () => {
            const error = new Error('Create directory error');
            fsStub.createDirectory.rejects(error);

            try {
                await adapter.createDirectory('/test/dir');
                expect.fail('エラーが発生するはずです');
            } catch (err) {
                expect(err).to.equal(error);
                sinon.assert.calledOnce(errorHandlerStub.handleError);
            }
        });
    });

    describe('delete', () => {
        it('パスを正常に削除する', async () => {
            fsStub.delete.resolves();

            await adapter.delete('/test/path');
            expect(fsStub.delete.calledOnce).to.be.true;
            sinon.assert.notCalled(errorHandlerStub.handleError);
        });

        it('再帰的な削除オプションを正しく処理する', async () => {
            fsStub.delete.resolves();

            await adapter.delete('/test/path', { recursive: true });
            expect(fsStub.delete.calledWith(
                sinon.match.any,
                { recursive: true }
            )).to.be.true;
            sinon.assert.notCalled(errorHandlerStub.handleError);
        });

        it('エラー時に適切に処理する', async () => {
            const error = new Error('Delete error');
            fsStub.delete.rejects(error);

            try {
                await adapter.delete('/test/path');
                expect.fail('エラーが発生するはずです');
            } catch (err) {
                expect(err).to.equal(error);
                sinon.assert.calledOnce(errorHandlerStub.handleError);
            }
        });
    });

    describe('copy', () => {
        it('ファイルを正常にコピーする', async () => {
            fsStub.copy.resolves();

            await adapter.copy('/test/source', '/test/target');
            expect(fsStub.copy.calledOnce).to.be.true;
            sinon.assert.notCalled(errorHandlerStub.handleError);
        });

        it('上書きオプションを正しく処理する', async () => {
            fsStub.copy.resolves();

            await adapter.copy('/test/source', '/test/target', { overwrite: true });
            expect(fsStub.copy.calledWith(
                sinon.match.any,
                sinon.match.any,
                { overwrite: true }
            )).to.be.true;
            sinon.assert.notCalled(errorHandlerStub.handleError);
        });

        it('エラー時に適切に処理する', async () => {
            const error = new Error('Copy error');
            fsStub.copy.rejects(error);

            try {
                await adapter.copy('/test/source', '/test/target');
                expect.fail('エラーが発生するはずです');
            } catch (err) {
                expect(err).to.equal(error);
                sinon.assert.calledOnce(errorHandlerStub.handleError);
            }
        });
    });

    describe('createDefault', () => {
        it('デフォルト設定でインスタンスを生成できる', () => {
            const defaultAdapter = FileSystemAdapter.createDefault(errorHandlerStub, loggerStub);
            expect(defaultAdapter).to.be.instanceOf(FileSystemAdapter);
        });
    });

    describe('パス解決のテスト', () => {
        it('パスを正規化して処理する', async () => {
            const filePath = '/test/path/../file.ts';
            const normalizedPath = path.normalize(filePath);
            fsStub.stat.resolves({
                type: vscode.FileType.File,
                ctime: Date.now(),
                mtime: Date.now(),
                size: 100
            });
            fsStub.readFile.resolves(Buffer.from('test content'));

            const result = await adapter.readFile(filePath);

            expect(result).to.equal('test content');
            sinon.assert.calledWith(fsStub.readFile, sinon.match((uri: vscode.Uri) => {
                return uri.fsPath === normalizedPath;
            }));
        });

        it('日本語を含むパスを正しく処理する', async () => {
            const filePath = '/test/テスト/ファイル.ts';
            fsStub.stat.resolves({
                type: vscode.FileType.File,
                ctime: Date.now(),
                mtime: Date.now(),
                size: 100
            });
            fsStub.readFile.resolves(Buffer.from('test content'));

            const result = await adapter.readFile(filePath);

            expect(result).to.equal('test content');
            sinon.assert.calledWith(fsStub.readFile, sinon.match((uri: vscode.Uri) => {
                return uri.fsPath === filePath;
            }));
        });

        it('存在しないファイルを適切に処理する', async () => {
            const filePath = '/test/notexist.ts';
            fsStub.stat.rejects(new Error('File not found'));

            const exists = await adapter.exists(filePath);
            expect(exists).to.be.false;
        });
    });

    describe('エラーハンドリングの詳細テスト', () => {
        it('ファイルの存在確認に失敗した場合のエラー', async () => {
            const filePath = '/test/error.ts';
            fsStub.stat.rejects(new Error('Access denied'));

            try {
                await adapter.readFile(filePath);
                expect.fail('エラーが発生するはずです');
            } catch (error) {
                const baseError = error as BaseError;
                expect(baseError).to.be.instanceOf(BaseError);
                expect(baseError.code).to.equal('FileSystemError');
                expect(baseError.message).to.equal('ファイルが存在しません');
                expect(baseError.details).to.deep.include({
                    path: filePath,
                    operation: 'readFile',
                    code: 'ENOENT'
                });
            }
        });

        it('ファイル読み込み時のパーミッションエラー', async () => {
            const filePath = '/test/permission.ts';
            fsStub.stat.resolves({
                type: vscode.FileType.File,
                ctime: Date.now(),
                mtime: Date.now(),
                size: 100
            });
            const fsError = new Error('EACCES: permission denied');
            (fsError as any).code = 'EACCES';
            fsStub.readFile.rejects(fsError);

            try {
                await adapter.readFile(filePath);
                expect.fail('エラーが発生するはずです');
            } catch (error) {
                const baseError = error as BaseError;
                expect(baseError).to.be.instanceOf(BaseError);
                expect(baseError.code).to.equal('FileSystemError');
                expect(baseError.details?.code).to.equal('EACCES');
                sinon.assert.calledWith(loggerStub.error as sinon.SinonStub, 
                    'ファイルシステム操作エラー: readFile',
                    sinon.match.object
                );
            }
        });

        it('空のファイルを適切に処理する', async () => {
            const filePath = '/test/empty.ts';
            fsStub.stat.resolves({
                type: vscode.FileType.File,
                ctime: Date.now(),
                mtime: Date.now(),
                size: 0
            });

            try {
                await adapter.readFile(filePath);
                expect.fail('エラーが発生するはずです');
            } catch (error) {
                const baseError = error as BaseError;
                expect(baseError).to.be.instanceOf(BaseError);
                expect(baseError.code).to.equal('FileSystemError');
                expect(baseError.message).to.equal('ファイルが空です');
                expect(baseError.details).to.deep.include({
                    path: filePath,
                    operation: 'readFile',
                    code: 'EMPTY_FILE'
                });
            }
        });

        it('メモリ不足エラーを適切に処理する', async () => {
            const filePath = '/test/large.ts';
            fsStub.stat.resolves({
                type: vscode.FileType.File,
                ctime: Date.now(),
                mtime: Date.now(),
                size: 100
            });
            const heapError = new Error('JavaScript heap out of memory');
            fsStub.readFile.rejects(heapError);

            try {
                await adapter.readFile(filePath);
                expect.fail('エラーが発生するはずです');
            } catch (error) {
                const baseError = error as BaseError;
                expect(baseError).to.be.instanceOf(BaseError);
                expect(baseError.code).to.equal('FileSystemError');
                expect(baseError.details).to.deep.include({
                    path: filePath,
                    operation: 'readFile',
                    originalError: 'JavaScript heap out of memory'
                });
                sinon.assert.calledWith(loggerStub.error as sinon.SinonStub, 
                    'ファイルシステム操作エラー: readFile',
                    sinon.match.object
                );
            }
        });
    });
});