import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { FileSystemAdapter } from '@/services/fs/FileSystemAdapter';
import { ErrorService } from '@/errors/services/ErrorService';

describe('FileSystemAdapter', () => {
    let adapter: FileSystemAdapter;
    let sandbox: sinon.SinonSandbox;
    let errorServiceStub: sinon.SinonStubbedInstance<ErrorService>;
    let fsStub: any;
    let originalGetInstance: any;

    before(() => {
        // ErrorService.getInstanceの元の実装を保存
        originalGetInstance = ErrorService.getInstance;
        
        // ErrorServiceのスタブを作成（テスト全体で1回だけ）
        errorServiceStub = sinon.createStubInstance(ErrorService);
        sinon.stub(ErrorService, 'getInstance').returns(errorServiceStub);
    });

    beforeEach(() => {
        sandbox = sinon.createSandbox();

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
        adapter = new FileSystemAdapter();
        Object.defineProperty(vscode.workspace, 'fs', {
            value: fsStub,
            configurable: true,
            writable: true
        });
    });

    afterEach(() => {
        sandbox.restore();
    });

    after(() => {
        // ErrorService.getInstanceを元に戻す
        sinon.restore();
        Object.defineProperty(ErrorService, 'getInstance', {
            value: originalGetInstance,
            configurable: true,
            writable: true
        });
    });

    describe('readFile', () => {
        it('ファイルを正常に読み込む', async () => {
            const content = 'test content';
            fsStub.readFile.resolves(Buffer.from(content));

            const result = await adapter.readFile('/test/path');
            assert.strictEqual(result, content);
            assert.ok(fsStub.readFile.calledOnce);
        });

        it('エラー時に適切に処理する', async () => {
            const error = new Error('Read error');
            fsStub.readFile.rejects(error);

            await assert.rejects(
                () => adapter.readFile('/test/path'),
                error
            );
        });
    });

    describe('writeFile', () => {
        it('ファイルを正常に書き込む', async () => {
            fsStub.writeFile.resolves();

            await adapter.writeFile('/test/path', 'test content');
            assert.ok(fsStub.writeFile.calledOnce);
        });

        it('エラー時に適切に処理する', async () => {
            const error = new Error('Write error');
            fsStub.writeFile.rejects(error);

            await assert.rejects(
                () => adapter.writeFile('/test/path', 'test content'),
                error
            );
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
            assert.deepStrictEqual(result, [
                { name: 'file1.txt', type: vscode.FileType.File },
                { name: 'dir1', type: vscode.FileType.Directory }
            ]);
            assert.ok(fsStub.readDirectory.calledOnce);
        });

        it('エラー時に適切に処理する', async () => {
            const error = new Error('Read directory error');
            fsStub.readDirectory.rejects(error);

            await assert.rejects(
                () => adapter.readDirectory('/test/dir'),
                error
            );
        });
    });

    describe('exists', () => {
        it('ファイルが存在する場合はtrueを返す', async () => {
            fsStub.stat.resolves({ type: vscode.FileType.File });

            const result = await adapter.exists('/test/path');
            assert.strictEqual(result, true);
            assert.ok(fsStub.stat.calledOnce);
        });

        it('ファイルが存在しない場合はfalseを返す', async () => {
            fsStub.stat.rejects(new Error('File not found'));

            const result = await adapter.exists('/test/path');
            assert.strictEqual(result, false);
            assert.ok(fsStub.stat.calledOnce);
        });
    });

    describe('createDirectory', () => {
        it('ディレクトリを正常に作成する', async () => {
            fsStub.createDirectory.resolves();

            await adapter.createDirectory('/test/dir');
            assert.ok(fsStub.createDirectory.calledOnce);
        });

        it('エラー時に適切に処理する', async () => {
            const error = new Error('Create directory error');
            fsStub.createDirectory.rejects(error);

            await assert.rejects(
                () => adapter.createDirectory('/test/dir'),
                error
            );
        });
    });

    describe('delete', () => {
        it('パスを正常に削除する', async () => {
            fsStub.delete.resolves();

            await adapter.delete('/test/path');
            assert.ok(fsStub.delete.calledOnce);
        });

        it('再帰的な削除オプションを正しく処理する', async () => {
            fsStub.delete.resolves();

            await adapter.delete('/test/path', { recursive: true });
            assert.ok(fsStub.delete.calledWith(
                sinon.match.any,
                { recursive: true }
            ));
        });

        it('エラー時に適切に処理する', async () => {
            const error = new Error('Delete error');
            fsStub.delete.rejects(error);

            await assert.rejects(
                () => adapter.delete('/test/path'),
                error
            );
        });
    });

    describe('copy', () => {
        it('ファイルを正常にコピーする', async () => {
            fsStub.copy.resolves();

            await adapter.copy('/test/source', '/test/target');
            assert.ok(fsStub.copy.calledOnce);
        });

        it('上書きオプションを正しく処理する', async () => {
            fsStub.copy.resolves();

            await adapter.copy('/test/source', '/test/target', { overwrite: true });
            assert.ok(fsStub.copy.calledWith(
                sinon.match.any,
                sinon.match.any,
                { overwrite: true }
            ));
        });

        it('エラー時に適切に処理する', async () => {
            const error = new Error('Copy error');
            fsStub.copy.rejects(error);

            await assert.rejects(
                () => adapter.copy('/test/source', '/test/target'),
                error
            );
        });
    });
});