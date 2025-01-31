import * as assert from 'assert';
import { performance } from 'perf_hooks';
import { DirectoryStructureService } from '../../domain/files/DirectoryStructureService';
import { ErrorService } from '../../shared/errors/services/ErrorService';
import { I18nService } from '../../i18n/I18nService';
import { LoggingService } from '../../infrastructure/logging/LoggingService';
import { ConfigurationService } from '../../infrastructure/config/ConfigurationService';
import { FileSystemEntity } from '../../types';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';

describe('Performance Tests', function() {
  // タイムアウトを30秒に設定
  this.timeout(30000);

  // パフォーマンステストが有効な場合のみ実行
  before(function() {
    if (!process.env.RUN_PERFORMANCE_TESTS) {
      this.skip();
    }
  });

  let directoryStructureService: DirectoryStructureService;
  let errorService: ErrorService;
  let i18nService: I18nService;
  let loggingService: LoggingService;
  let configService: ConfigurationService;
  let outputChannel: vscode.LogOutputChannel;

  beforeEach(() => {
    outputChannel = vscode.window.createOutputChannel('Matomeru Test', { log: true });
    configService = new ConfigurationService();
    loggingService = new LoggingService(outputChannel, configService);
    i18nService = I18nService.createDefault(loggingService);
    errorService = ErrorService.createDefault(loggingService);
    directoryStructureService = DirectoryStructureService.createDefault(errorService);
  });

  afterEach(() => {
    outputChannel.dispose();
  });

  // テストデータの作成
  const createTestFiles = async (dirPath: string, count: number) => {
    await fs.ensureDir(dirPath);
    const entities: FileSystemEntity[] = [];

    for (let i = 0; i < count; i++) {
      const filePath = path.join(dirPath, `test-file-${i}.txt`);
      await fs.writeFile(filePath, `Test content ${i}`);
      entities.push({
        path: filePath,
        type: 'file',
        content: `Test content ${i}`
      });
    }

    return entities;
  };

  it('should process small directory (100 files) within 1 second', async () => {
    const startTime = performance.now();
    
    // テスト用の小規模ディレクトリのパスを指定
    const smallDirPath = './src/test/performance/fixtures/small';
    const entities = await createTestFiles(smallDirPath, 100);
    
    const result = directoryStructureService.generateTreeStructure(entities);
    assert.ok(result.length > 0);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    assert.ok(duration < 1000, `処理時間が1秒を超えました: ${duration}ms`);

    // クリーンアップ
    await fs.remove(smallDirPath);
  });

  it('should process medium directory (1000 files) within 3 seconds', async () => {
    const startTime = performance.now();
    
    // テスト用の中規模ディレクトリのパスを指定
    const mediumDirPath = './src/test/performance/fixtures/medium';
    const entities = await createTestFiles(mediumDirPath, 1000);
    
    const result = directoryStructureService.generateTreeStructure(entities);
    assert.ok(result.length > 0);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    assert.ok(duration < 3000, `処理時間が3秒を超えました: ${duration}ms`);

    // クリーンアップ
    await fs.remove(mediumDirPath);
  });

  // メモリ使用量のテスト
  it('should maintain reasonable memory usage', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // テスト用のディレクトリのパスを指定
    const testDirPath = './src/test/performance/fixtures/medium';
    const entities = await createTestFiles(testDirPath, 1000);
    
    const result = directoryStructureService.generateTreeStructure(entities);
    assert.ok(result.length > 0);
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB単位
    
    assert.ok(memoryIncrease < 200, `メモリ使用量が200MBを超えました: ${memoryIncrease}MB`);

    // クリーンアップ
    await fs.remove(testDirPath);
  });
}); 