import * as vscode from 'vscode';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { FileSystemAdapter } from '@/domain/files/FileSystemAdapter';
import { IErrorHandler } from '@/shared/errors/services/ErrorService';

describe('FileSystemAdapter', () => {
    let adapter: FileSystemAdapter;
    let sandbox: sinon.SinonSandbox;
    let errorHandlerStub: {
        handleError: sinon.SinonStub;
        getErrorLogs: sinon.SinonStub;
        clearErrorLogs: sinon.SinonStub;
    };
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

        // ErrorHandlerのスタブを作成
        errorHandlerStub = {
            handleError: sandbox.stub().resolves(),
            getErrorLogs: sandbox.stub().returns([]),
            clearErrorLogs: sandbox.stub()
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
        adapter = new FileSystemAdapter(errorHandlerStub);
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
            fsStub.readFile.resolves(Buffer.from(content));

            const result = await adapter.readFile('/test/path');
            expect(result).to.equal(content);
            expect(fsStub.readFile.calledOnce).to.be.true;
            expect(errorHandlerStub.handleError.called).to.be.false;
        });

        it('エラー時に適切に処理する', async () => {
            const error = new Error('Read error');
            fsStub.readFile.rejects(error);

            try {
                await adapter.readFile('/test/path');
                expect.fail('エラーが発生するはずです');
            } catch (err) {
                expect(err).to.equal(error);
                expect(errorHandlerStub.handleError.calledOnce).to.be.true;
            }
        });
    });

    describe('writeFile', () => {
        it('ファイルを正常に書き込む', async () => {
            fsStub.writeFile.resolves();

            await adapter.writeFile('/test/path', 'test content');
            expect(fsStub.writeFile.calledOnce).to.be.true;
            expect(errorHandlerStub.handleError.called).to.be.false;
        });

        it('エラー時に適切に処理する', async () => {
            const error = new Error('Write error');
            fsStub.writeFile.rejects(error);

            try {
                await adapter.writeFile('/test/path', 'test content');
                expect.fail('エラーが発生するはずです');
            } catch (err) {
                expect(err).to.equal(error);
                expect(errorHandlerStub.handleError.calledOnce).to.be.true;
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
            expect(errorHandlerStub.handleError.called).to.be.false;
        });

        it('エラー時に適切に処理する', async () => {
            const error = new Error('Read directory error');
            fsStub.readDirectory.rejects(error);

            try {
                await adapter.readDirectory('/test/dir');
                expect.fail('エラーが発生するはずです');
            } catch (err) {
                expect(err).to.equal(error);
                expect(errorHandlerStub.handleError.calledOnce).to.be.true;
            }
        });
    });

    describe('exists', () => {
        it('ファイルが存在する場合はtrueを返す', async () => {
            fsStub.stat.resolves({ type: vscode.FileType.File });

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
            expect(errorHandlerStub.handleError.called).to.be.false;
        });

        it('エラー時に適切に処理する', async () => {
            const error = new Error('Create directory error');
            fsStub.createDirectory.rejects(error);

            try {
                await adapter.createDirectory('/test/dir');
                expect.fail('エラーが発生するはずです');
            } catch (err) {
                expect(err).to.equal(error);
                expect(errorHandlerStub.handleError.calledOnce).to.be.true;
            }
        });
    });

    describe('delete', () => {
        it('パスを正常に削除する', async () => {
            fsStub.delete.resolves();

            await adapter.delete('/test/path');
            expect(fsStub.delete.calledOnce).to.be.true;
            expect(errorHandlerStub.handleError.called).to.be.false;
        });

        it('再帰的な削除オプションを正しく処理する', async () => {
            fsStub.delete.resolves();

            await adapter.delete('/test/path', { recursive: true });
            expect(fsStub.delete.calledWith(
                sinon.match.any,
                { recursive: true }
            )).to.be.true;
            expect(errorHandlerStub.handleError.called).to.be.false;
        });

        it('エラー時に適切に処理する', async () => {
            const error = new Error('Delete error');
            fsStub.delete.rejects(error);

            try {
                await adapter.delete('/test/path');
                expect.fail('エラーが発生するはずです');
            } catch (err) {
                expect(err).to.equal(error);
                expect(errorHandlerStub.handleError.calledOnce).to.be.true;
            }
        });
    });

    describe('copy', () => {
        it('ファイルを正常にコピーする', async () => {
            fsStub.copy.resolves();

            await adapter.copy('/test/source', '/test/target');
            expect(fsStub.copy.calledOnce).to.be.true;
            expect(errorHandlerStub.handleError.called).to.be.false;
        });

        it('上書きオプションを正しく処理する', async () => {
            fsStub.copy.resolves();

            await adapter.copy('/test/source', '/test/target', { overwrite: true });
            expect(fsStub.copy.calledWith(
                sinon.match.any,
                sinon.match.any,
                { overwrite: true }
            )).to.be.true;
            expect(errorHandlerStub.handleError.called).to.be.false;
        });

        it('エラー時に適切に処理する', async () => {
            const error = new Error('Copy error');
            fsStub.copy.rejects(error);

            try {
                await adapter.copy('/test/source', '/test/target');
                expect.fail('エラーが発生するはずです');
            } catch (err) {
                expect(err).to.equal(error);
                expect(errorHandlerStub.handleError.calledOnce).to.be.true;
            }
        });
    });

    describe('createDefault', () => {
        it('デフォルト設定でインスタンスを生成できる', () => {
            const defaultAdapter = FileSystemAdapter.createDefault(errorHandlerStub);
            expect(defaultAdapter).to.be.instanceOf(FileSystemAdapter);
        });
    });
});