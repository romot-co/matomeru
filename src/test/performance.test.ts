import * as assert from 'assert';
import * as path from 'path';
import { DirectoryScanner } from '../extension';
import { MockFSAdapter } from '../extension';
import { performance } from 'perf_hooks';

interface ScanProgress {
    currentFile: string;
    processed: number;
    total: number;
    speed: number;
    startTime: number;
}

suite('パフォーマンステスト', () => {
    const createMockFiles = (count: number) => {
        const files: Record<string, string> = {};
        for (let i = 0; i < count; i++) {
            files[`/test/path/file${i}.txt`] = `Content of file ${i}`;
        }
        return files;
    };

    const measureMemoryUsage = () => {
        const used = process.memoryUsage();
        return {
            heapUsed: Math.round(used.heapUsed / 1024 / 1024),
            heapTotal: Math.round(used.heapTotal / 1024 / 1024),
            rss: Math.round(used.rss / 1024 / 1024)
        };
    };

    test('並列処理の効率性テスト', async () => {
        const fileCount = 1000;
        const mockFiles = createMockFiles(fileCount);
        const fsAdapter = new MockFSAdapter(mockFiles);

        // 異なる並列数でのテスト
        const concurrencyLevels = [1, 5, 10, 20];
        const results: Record<number, number> = {};

        for (const concurrency of concurrencyLevels) {
            const scanner = new DirectoryScanner(fsAdapter, undefined, {
                maxConcurrency: concurrency,
                batchSize: 100,
                excludePatterns: []
            });
            
            const startTime = performance.now();
            await scanner.scan('/test/path');
            const endTime = performance.now();
            
            results[concurrency] = endTime - startTime;
        }

        // 並列処理が効果的に機能していることを確認
        assert.strictEqual(
            results[5] < results[1],
            true,
            '並列処理が単一処理より高速であること'
        );
    });

    test('メモリ使用量の最適化テスト', async () => {
        const fileCount = 5000;
        const mockFiles = createMockFiles(fileCount);
        const fsAdapter = new MockFSAdapter(mockFiles);
        const scanner = new DirectoryScanner(fsAdapter);

        const initialMemory = measureMemoryUsage();
        
        await scanner.scan('/test/path');
        
        const finalMemory = measureMemoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

        // メモリ使用量の増加が許容範囲内であることを確認
        assert.strictEqual(
            memoryIncrease < 500,
            true,
            'メモリ使用量の増加が500MB未満であること'
        );
    });

    test('バッチ処理の効率性テスト', async () => {
        const fileCount = 2000;
        const mockFiles = createMockFiles(fileCount);
        const fsAdapter = new MockFSAdapter(mockFiles);

        let processedFiles = 0;
        let lastBatchTime = performance.now();
        let maxBatchTime = 0;

        const scanner = new DirectoryScanner(fsAdapter, (progress: ScanProgress) => {
            const currentTime = performance.now();
            const batchTime = currentTime - lastBatchTime;
            maxBatchTime = Math.max(maxBatchTime, batchTime);
            
            processedFiles = progress.processed;
            lastBatchTime = currentTime;
        });

        await scanner.scan('/test/path');

        // すべてのファイルが処理されたことを確認
        assert.strictEqual(processedFiles, fileCount);
        
        // 各バッチの処理時間が許容範囲内であることを確認
        assert.strictEqual(
            maxBatchTime < 1000,
            true,
            '各バッチの処理時間が1秒未満であること'
        );
    });

    test('大規模ディレクトリの処理テスト', async () => {
        const fileCount = 10000;
        const mockFiles = createMockFiles(fileCount);
        const fsAdapter = new MockFSAdapter(mockFiles);
        const scanner = new DirectoryScanner(fsAdapter);

        const startMemory = measureMemoryUsage();
        const startTime = performance.now();
        
        await scanner.scan('/test/path');
        
        const endTime = performance.now();
        const endMemory = measureMemoryUsage();

        const processingTime = endTime - startTime;
        const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;

        // 処理時間とメモリ使用量が許容範囲内であることを確認
        assert.strictEqual(
            processingTime < 30000,
            true,
            '大規模ディレクトリの処理が30秒以内に完了すること'
        );
        
        assert.strictEqual(
            memoryIncrease < 1000,
            true,
            '大規模ディレクトリ処理時のメモリ増加が1GB未満であること'
        );
    });
}); 
