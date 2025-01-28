import * as assert from 'assert';
import { DirectoryScanner } from '../services/directory-scanner';
import { FSAdapter } from '../services/fs-adapter';
import { ScanProgress } from '../types';
import * as sinon from 'sinon';

suite('パフォーマンステスト', () => {
    let fsAdapter: FSAdapter;
    let scanner: DirectoryScanner;

    setup(() => {
        fsAdapter = {
            readFile: sinon.stub().resolves('test content'),
            stat: sinon.stub().resolves({
                isDirectory: () => false,
                isSymbolicLink: () => false
            }),
            readdir: sinon.stub().resolves([]),
            findFiles: sinon.stub().resolves([]),
            getFileExtension: () => '.txt',
            exists: sinon.stub().resolves(true)
        };
    });

    test('大量のファイルを効率的に処理できる', async () => {
        const fileCount = 1000;
        const files = Array.from({ length: fileCount }, (_, i) => `/test/file${i}.txt`);
        (fsAdapter.findFiles as sinon.SinonStub).resolves(files);

        let lastProgress = 0;
        const onProgress = (progress: ScanProgress) => {
            lastProgress = progress.progress;
            assert.ok(progress.progress >= 0 && progress.progress <= 100);
            assert.ok(typeof progress.message === 'string');
        };

        const scanner = new DirectoryScanner(fsAdapter, onProgress, {
            maxConcurrency: 10,
            batchSize: 50
        });

        const startTime = Date.now();
        const results = await scanner.scan('/test');
        const endTime = Date.now();

        assert.strictEqual(results.length, fileCount);
        assert.ok(lastProgress === 100);

        const processingTime = endTime - startTime;
        console.log(`処理時間: ${processingTime}ms`);
        assert.ok(processingTime < 5000, '処理に5秒以上かかっています');
    });

    test('メモリ使用量を制御できる', async () => {
        const fileCount = 5000;
        const files = Array.from({ length: fileCount }, (_, i) => `/test/file${i}.txt`);
        (fsAdapter.findFiles as sinon.SinonStub).resolves(files);

        const scanner = new DirectoryScanner(fsAdapter, undefined, {
            maxConcurrency: 5,
            batchSize: 100
        });

        const startTime = Date.now();
        const results = await scanner.scan('/test');
        const endTime = Date.now();

        assert.strictEqual(results.length, fileCount);

        const processingTime = endTime - startTime;
        console.log(`処理時間: ${processingTime}ms`);
        assert.ok(processingTime < 10000, '処理に10秒以上かかっています');
    });
}); 
