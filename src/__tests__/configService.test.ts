import * as vscode from 'vscode';
import { ConfigService } from '../services/configService';
import { defaultConfig } from '../types/configTypes';

// VSCodeのAPIをモック
jest.mock('vscode', () => ({
    workspace: {
        getConfiguration: jest.fn(() => ({
            get: jest.fn()
        }))
    }
}));

describe('ConfigService', () => {
    let configService: ConfigService;
    const mockGetConfiguration = vscode.workspace.getConfiguration as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        // シングルトンインスタンスをリセット
        (ConfigService as any).instance = null;
        // デフォルトのモック実装
        const mockGet = jest.fn((key: string, defaultValue?: any) => {
            switch (key) {
                case 'maxFileSize':
                    return 1048576; // デフォルト値と同じ
                case 'excludePatterns':
                    return ['node_modules/**', '.git/**'];
                case 'chatGptIntegration':
                    return true;
                case 'directoryStructure.directoryIcon':
                    return '📂';
                case 'directoryStructure.fileIcon':
                    return '📝';
                case 'directoryStructure.indentSize':
                    return 4;
                case 'directoryStructure.showFileExtensions':
                    return false;
                case 'directoryStructure.useEmoji':
                    return false;
                default:
                    return defaultValue;
            }
        });
        mockGetConfiguration.mockReturnValue({ get: mockGet });
        configService = ConfigService.getInstance();
    });

    afterEach(() => {
        // シングルトンインスタンスをリセット
        (ConfigService as any).instance = null;
    });

    describe('getInstance', () => {
        it('同じインスタンスを返す', () => {
            // 既存のインスタンスをリセット
            (ConfigService as any).instance = null;

            // 新しいインスタンスを取得
            const instance1 = ConfigService.getInstance();
            const instance2 = ConfigService.getInstance();

            // 同じインスタンスであることを確認
            expect(instance1).toBe(instance2);
            expect(instance1).toHaveProperty('getConfig');
            expect(instance1).toHaveProperty('reload');
        });
    });

    describe('getConfig', () => {
        it('設定値を正しく取得する', () => {
            const config = configService.getConfig();
            
            expect(config.maxFileSize).toBe(1048576);
            expect(config.excludePatterns).toEqual(['node_modules/**', '.git/**']);
            expect(config.chatGptIntegration).toBe(true);
            expect(config.directoryStructure).toEqual({
                directoryIcon: '📂',
                fileIcon: '📝',
                indentSize: 4,
                showFileExtensions: false,
                useEmoji: false
            });
        });

        it('設定値が未定義の場合、デフォルト値を使用する', () => {
            const mockGet = jest.fn(() => undefined);
            mockGetConfiguration.mockReturnValue({ get: mockGet });

            // インスタンスをリセットして新規取得
            (ConfigService as any).instance = null;
            configService = ConfigService.getInstance();
            const config = configService.getConfig();

            // デフォルト値と比較（excludePatternsは一部のみ確認）
            expect(config.maxFileSize).toBe(defaultConfig.maxFileSize);
            expect(config.excludePatterns).toContain('node_modules/**');
            expect(config.excludePatterns).toContain('.git/**');
            expect(config.chatGptIntegration).toBe(defaultConfig.chatGptIntegration);
            expect(config.directoryStructure).toEqual(defaultConfig.directoryStructure);
        });

        it('設定オブジェクトの変更が元の設定に影響しない', () => {
            const config = configService.getConfig();
            const originalMaxFileSize = config.maxFileSize;
            const originalExcludePatterns = [...config.excludePatterns];
            const originalDirectoryStructure = { ...config.directoryStructure };

            // 設定を変更
            config.maxFileSize = 9999999;
            config.excludePatterns.push('test/**');
            config.directoryStructure.indentSize = 8;

            // 新しい設定を取得
            const newConfig = configService.getConfig();
            expect(newConfig.maxFileSize).toBe(originalMaxFileSize);
            expect(newConfig.excludePatterns).toEqual(originalExcludePatterns);
            expect(newConfig.directoryStructure).toEqual(originalDirectoryStructure);
        });
    });

    describe('reload', () => {
        it('設定を再読み込みする', () => {
            // 初期設定を取得
            const initialConfig = configService.getConfig();
            expect(initialConfig.maxFileSize).toBe(1048576);

            // モックの実装を変更
            const mockGet = jest.fn((key: string, defaultValue?: any) => {
                if (key === 'maxFileSize') {
                    return 2097152; // 新しい値
                }
                return defaultValue;
            });
            mockGetConfiguration.mockReturnValue({ get: mockGet });

            // 設定を再読み込み
            configService.reload();
            const reloadedConfig = configService.getConfig();

            // 新しい値が反映されていることを確認
            expect(reloadedConfig.maxFileSize).toBe(2097152);
            // その他の設定はデフォルト値になっているはず
            expect(reloadedConfig.excludePatterns).toContain('node_modules/**');
            expect(reloadedConfig.excludePatterns).toContain('.git/**');
            expect(reloadedConfig.chatGptIntegration).toBe(defaultConfig.chatGptIntegration);
            expect(reloadedConfig.directoryStructure).toEqual(defaultConfig.directoryStructure);
        });
    });
}); 