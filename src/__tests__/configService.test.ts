import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { ConfigService } from '../services/configService';
import { defaultConfig } from '../types/configTypes';

jest.mock('vscode');

describe('ConfigService', () => {
    let mockConfig: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // ConfigServiceのインスタンスをリセット
        ConfigService.resetInstance();

        mockConfig = {
            get: jest.fn(),
            has: jest.fn().mockReturnValue(true),
            inspect: jest.fn(),
            update: jest.fn()
        };
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
    });

    describe('シングルトンパターン', () => {
        test('同じインスタンスを返すこと', () => {
            const instance1 = ConfigService.getInstance();
            const instance2 = ConfigService.getInstance();
            expect(instance1).toBe(instance2);
        });

        test('resetInstance後は新しいインスタンスを作成すること', () => {
            const instance1 = ConfigService.getInstance();
            ConfigService.resetInstance();
            const instance2 = ConfigService.getInstance();
            expect(instance1).not.toBe(instance2);
        });

        test('複数スレッドから同時アクセスでも同じインスタンスを返すこと', async () => {
            const promises = Array(10).fill(0).map(() => 
                Promise.resolve(ConfigService.getInstance())
            );
            const instances = await Promise.all(promises);
            
            // すべて同じインスタンス
            instances.forEach(instance => {
                expect(instance).toBe(instances[0]);
            });
        });
    });

    describe('デフォルト設定の適用', () => {
        test('設定が未定義の場合、デフォルト値を返すこと', () => {
            mockConfig.get.mockReturnValue(undefined);
            
            const config = ConfigService.getInstance().getConfig();
            
            expect(config.maxFileSize).toBe(defaultConfig.maxFileSize);
            expect(config.excludePatterns).toEqual(defaultConfig.excludePatterns);
            expect(config.chatGptIntegration).toBe(defaultConfig.chatGptIntegration);
            expect(config.directoryStructure).toEqual(defaultConfig.directoryStructure);
            expect(config.useGitignore).toBe(defaultConfig.useGitignore);
            expect(config.useVscodeignore).toBe(defaultConfig.useVscodeignore);
            expect(config.prefixText).toBe(defaultConfig.prefixText);
        });

        test('部分的な設定でもデフォルト値で補完されること', () => {
            mockConfig.get.mockImplementation((key: string) => {
                if (key === 'maxFileSize') return 512 * 1024;
                if (key === 'directoryStructure.useEmoji') return false;
                return undefined;
            });
            
            const config = ConfigService.getInstance().getConfig();
            
            expect(config.maxFileSize).toBe(512 * 1024);
            expect(config.directoryStructure.useEmoji).toBe(false);
            expect(config.directoryStructure.directoryIcon).toBe(defaultConfig.directoryStructure.directoryIcon);
            expect(config.excludePatterns).toEqual(defaultConfig.excludePatterns);
        });

        test('ネストされた設定オブジェクトが正しくマージされること', () => {
            mockConfig.get.mockImplementation((key: string) => {
                if (key === 'directoryStructure.indentSize') return 8;
                if (key === 'directoryStructure.showFileExtensions') return false;
                return undefined;
            });
            
            const config = ConfigService.getInstance().getConfig();
            
            expect(config.directoryStructure.indentSize).toBe(8);
            expect(config.directoryStructure.showFileExtensions).toBe(false);
            // 他のプロパティはデフォルト値を保持
            expect(config.directoryStructure.directoryIcon).toBe(defaultConfig.directoryStructure.directoryIcon);
            expect(config.directoryStructure.fileIcon).toBe(defaultConfig.directoryStructure.fileIcon);
            expect(config.directoryStructure.useEmoji).toBe(defaultConfig.directoryStructure.useEmoji);
        });
    });

    describe('ユーザー設定の上書き', () => {
        test('カスタム設定が正しく適用されること', () => {
            const customExcludePatterns = ['*.tmp', 'build/**'];
            const customMaxFileSize = 2 * 1024 * 1024;
            
            mockConfig.get.mockImplementation((key: string) => {
                switch (key) {
                    case 'maxFileSize':
                        return customMaxFileSize;
                    case 'excludePatterns':
                        return customExcludePatterns;
                    case 'chatGptIntegration':
                        return true;
                    case 'directoryStructure.directoryIcon':
                        return '[DIR]';
                    case 'directoryStructure.fileIcon':
                        return '[FILE]';
                    case 'directoryStructure.indentSize':
                        return 4;
                    case 'directoryStructure.showFileExtensions':
                        return false;
                    case 'directoryStructure.useEmoji':
                        return false;
                    case 'useGitignore':
                        return true;
                    case 'useVscodeignore':
                        return false;
                    case 'prefixText':
                        return 'Custom prefix';
                    default:
                        return undefined;
                }
            });
            
            const config = ConfigService.getInstance().getConfig();
            
            expect(config.maxFileSize).toBe(customMaxFileSize);
            // excludePatterns はデフォルトパターンとユーザー設定がマージされる
            expect(config.excludePatterns).toContain('*.tmp');
            expect(config.excludePatterns).toContain('build/**');
            expect(config.excludePatterns).toContain('node_modules/**'); // デフォルトパターンも含まれる
            expect(config.chatGptIntegration).toBe(true);
            expect(config.directoryStructure.directoryIcon).toBe('[DIR]');
            expect(config.directoryStructure.fileIcon).toBe('[FILE]');
            expect(config.directoryStructure.indentSize).toBe(4);
            expect(config.directoryStructure.showFileExtensions).toBe(false);
            expect(config.directoryStructure.useEmoji).toBe(false);
            expect(config.useGitignore).toBe(true);
            expect(config.useVscodeignore).toBe(false);
            expect(config.prefixText).toBe('Custom prefix');
        });

        test('配列設定がデフォルトとマージされること', () => {
            const customPatterns = ['custom1', 'custom2/**', '!important.js'];
            
            mockConfig.get.mockImplementation((key: string) => {
                if (key === 'excludePatterns') return customPatterns;
                return undefined;
            });
            
            const config = ConfigService.getInstance().getConfig();
            
            // カスタムパターンが含まれる
            expect(config.excludePatterns).toContain('custom1');
            expect(config.excludePatterns).toContain('custom2/**');
            expect(config.excludePatterns).toContain('!important.js');
            
            // デフォルトパターンも含まれる
            expect(config.excludePatterns).toContain('node_modules/**');
            expect(config.excludePatterns).toContain('.git/**');
            expect(config.excludePatterns).toContain('*.env*');
            
            // 重複がない
            const uniquePatterns = [...new Set(config.excludePatterns)];
            expect(config.excludePatterns.length).toBe(uniquePatterns.length);
        });
    });

    describe('設定の動的な反映', () => {
        test('reload()でVSCode設定の変更が反映されること', () => {
            // 初期設定
            mockConfig.get.mockImplementation((key: string) => {
                if (key === 'maxFileSize') return 1024;
                return undefined;
            });
            
            const configService = ConfigService.getInstance();
            const initialConfig = configService.getConfig();
            expect(initialConfig.maxFileSize).toBe(1024);
            
            // 設定を変更
            mockConfig.get.mockImplementation((key: string) => {
                if (key === 'maxFileSize') return 2048;
                return undefined;
            });
            
            // reload前は古い設定
            const configBeforeReload = configService.getConfig();
            expect(configBeforeReload.maxFileSize).toBe(1024);
            
            // reload後は新しい設定
            configService.reload();
            const configAfterReload = configService.getConfig();
            expect(configAfterReload.maxFileSize).toBe(2048);
        });

        test('複数の設定項目が同時に変更された場合も正しく反映されること', () => {
            // 初期設定
            mockConfig.get.mockImplementation((key: string) => {
                if (key === 'maxFileSize') return 1024;
                if (key === 'chatGptIntegration') return false;
                if (key === 'excludePatterns') return ['*.log'];
                return undefined;
            });
            
            const configService = ConfigService.getInstance();
            const initialConfig = configService.getConfig();
            expect(initialConfig.maxFileSize).toBe(1024);
            expect(initialConfig.chatGptIntegration).toBe(false);
            expect(initialConfig.excludePatterns).toContain('*.log');
            expect(initialConfig.excludePatterns).toContain('node_modules/**'); // デフォルトも含まれる
            
            // 複数設定を同時変更
            mockConfig.get.mockImplementation((key: string) => {
                if (key === 'maxFileSize') return 4096;
                if (key === 'chatGptIntegration') return true;
                if (key === 'excludePatterns') return ['*.tmp', '*.log'];
                return undefined;
            });
            
            configService.reload();
            const newConfig = configService.getConfig();
            expect(newConfig.maxFileSize).toBe(4096);
            expect(newConfig.chatGptIntegration).toBe(true);
            expect(newConfig.excludePatterns).toContain('*.tmp');
            expect(newConfig.excludePatterns).toContain('*.log');
            expect(newConfig.excludePatterns).toContain('node_modules/**'); // デフォルトも含まれる
        });
    });

    describe('無効な設定値の処理', () => {
        test('null値がある場合、デフォルト値を使用すること', () => {
            mockConfig.get.mockReturnValue(null);
            
            const config = ConfigService.getInstance().getConfig();
            
            expect(config.maxFileSize).toBe(defaultConfig.maxFileSize);
            expect(config.excludePatterns).toEqual(defaultConfig.excludePatterns);
        });

        test('excludePatternsがnullの場合、デフォルトの配列を使用すること', () => {
            mockConfig.get.mockImplementation((key: string) => {
                if (key === 'excludePatterns') return null;
                return undefined;
            });
            
            const config = ConfigService.getInstance().getConfig();
            
            expect(config.excludePatterns).toEqual(defaultConfig.excludePatterns);
        });

        test('無効な型の設定値は無視されること', () => {
            mockConfig.get.mockImplementation((key: string) => {
                if (key === 'maxFileSize') return 'invalid';
                if (key === 'chatGptIntegration') return 'true';
                if (key === 'excludePatterns') return 'not-an-array';
                return undefined;
            });
            
            const config = ConfigService.getInstance().getConfig();
            
            // 無効な値の場合はデフォルト値が使用される
            expect(config.maxFileSize).toBe(defaultConfig.maxFileSize);
            expect(config.chatGptIntegration).toBe(defaultConfig.chatGptIntegration);
            expect(config.excludePatterns).toEqual(defaultConfig.excludePatterns);
        });

        test('負の数値は無効として扱われること', () => {
            mockConfig.get.mockImplementation((key: string) => {
                if (key === 'maxFileSize') return -1000;
                if (key === 'directoryStructure.indentSize') return -2;
                return undefined;
            });
            
            const config = ConfigService.getInstance().getConfig();
            
            expect(config.maxFileSize).toBe(defaultConfig.maxFileSize);
            expect(config.directoryStructure.indentSize).toBe(defaultConfig.directoryStructure.indentSize);
        });

        test('極端に大きな値は無効として扱われること', () => {
            mockConfig.get.mockImplementation((key: string) => {
                if (key === 'maxFileSize') return Number.MAX_SAFE_INTEGER + 1;
                return undefined;
            });
            
            const config = ConfigService.getInstance().getConfig();
            
            expect(config.maxFileSize).toBe(defaultConfig.maxFileSize);
        });
    });

    describe('設定オブジェクトの安全性', () => {
        test('getConfig()が設定の浅いコピーを返すこと', () => {
            const config1 = ConfigService.getInstance().getConfig();
            const config2 = ConfigService.getInstance().getConfig();
            
            // オブジェクト自体は別のインスタンス
            expect(config1).not.toBe(config2);
            expect(config1.excludePatterns).not.toBe(config2.excludePatterns);
            expect(config1.directoryStructure).not.toBe(config2.directoryStructure);
            
            // しかし内容は同じ
            expect(config1).toEqual(config2);
        });

        test('返された設定を変更しても内部状態に影響しないこと', () => {
            const config = ConfigService.getInstance().getConfig();
            const originalExcludePatterns = [...config.excludePatterns];
            const originalDirectoryStructure = { ...config.directoryStructure };
            
            // 設定を変更
            config.excludePatterns.push('malicious-pattern');
            config.directoryStructure.indentSize = 999;
            config.maxFileSize = 0;
            
            // 新しく取得した設定は変更されていない
            const freshConfig = ConfigService.getInstance().getConfig();
            expect(freshConfig.excludePatterns).toEqual(originalExcludePatterns);
            expect(freshConfig.directoryStructure).toEqual(originalDirectoryStructure);
            expect(freshConfig.maxFileSize).toBe(defaultConfig.maxFileSize);
        });

        test('配列のディープコピーが正しく行われること', () => {
            mockConfig.get.mockImplementation((key: string) => {
                if (key === 'excludePatterns') return ['*.log', 'node_modules/**'];
                return undefined;
            });
            
            const config1 = ConfigService.getInstance().getConfig();
            const config2 = ConfigService.getInstance().getConfig();
            
            // 配列自体は別のインスタンス
            expect(config1.excludePatterns).not.toBe(config2.excludePatterns);
            expect(config1.excludePatterns).toEqual(config2.excludePatterns);
            
            // 一方を変更してももう一方は影響されない
            config1.excludePatterns.push('test');
            expect(config2.excludePatterns).not.toContain('test');
        });
    });

    describe('VSCode設定との統合', () => {
        test('vscode.workspace.getConfigurationが正しく呼ばれること', () => {
            ConfigService.getInstance().getConfig();
            
            expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('matomeru');
        });

        test('設定セクションが存在しない場合でも正常に動作すること', () => {
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(undefined);
            
            const config = ConfigService.getInstance().getConfig();
            
            // デフォルト設定が返される
            expect(config).toEqual(defaultConfig);
        });

        test('getConfigurationでエラーが発生した場合もデフォルト設定を返すこと', () => {
            (vscode.workspace.getConfiguration as jest.Mock).mockImplementation(() => {
                throw new Error('Configuration error');
            });
            
            const config = ConfigService.getInstance().getConfig();
            
            // デフォルト設定が返される
            expect(config).toEqual(defaultConfig);
        });
    });

    describe('設定値の検証', () => {
        test('maxFileSizeは正の整数のみ受け入れること', () => {
            const validValues = [1024, 1024 * 1024, 1024 * 1024 * 50];
            const invalidValues = [0, -1, 1.5, 'string', null, undefined];
            
            validValues.forEach(value => {
                mockConfig.get.mockImplementation((key: string) => {
                    if (key === 'maxFileSize') return value;
                    return undefined;
                });
                
                const config = ConfigService.getInstance().getConfig();
                expect(config.maxFileSize).toBe(value);
                
                ConfigService.resetInstance();
            });
            
            invalidValues.forEach(value => {
                mockConfig.get.mockImplementation((key: string) => {
                    if (key === 'maxFileSize') return value;
                    return undefined;
                });
                
                const config = ConfigService.getInstance().getConfig();
                expect(config.maxFileSize).toBe(defaultConfig.maxFileSize);
                
                ConfigService.resetInstance();
            });
        });

        test('excludePatternsは文字列配列のみ受け入れること', () => {
            const validValues = [
                ['*.log'],
                ['node_modules/**', '*.tmp'],
                []
            ];
            const invalidValues = [
                'string',
                123,
                null,
                undefined,
                [123, 'valid'],
                ['valid', null]
            ];
            
            validValues.forEach(value => {
                mockConfig.get.mockImplementation((key: string) => {
                    if (key === 'excludePatterns') return value;
                    return undefined;
                });
                
                const config = ConfigService.getInstance().getConfig();
                // ユーザーパターンがすべて含まれる
                value.forEach((pattern: string) => {
                    expect(config.excludePatterns).toContain(pattern);
                });
                // デフォルトパターンも含まれる
                expect(config.excludePatterns).toContain('node_modules/**');
                
                ConfigService.resetInstance();
            });
            
            invalidValues.forEach(value => {
                mockConfig.get.mockImplementation((key: string) => {
                    if (key === 'excludePatterns') return value;
                    return undefined;
                });
                
                const config = ConfigService.getInstance().getConfig();
                expect(config.excludePatterns).toEqual(defaultConfig.excludePatterns);
                
                ConfigService.resetInstance();
            });
        });

        test('boolean設定は真偽値のみ受け入れること', () => {
            const booleanKeys = ['chatGptIntegration', 'useGitignore', 'useVscodeignore'];
            const validValues = [true, false];
            const invalidValues = ['true', 'false', 1, 0, null, undefined];
            
            booleanKeys.forEach(key => {
                validValues.forEach(value => {
                    mockConfig.get.mockImplementation((k: string) => {
                        if (k === key) return value;
                        return undefined;
                    });
                    
                    const config = ConfigService.getInstance().getConfig();
                    expect((config as any)[key]).toBe(value);
                    
                    ConfigService.resetInstance();
                });
                
                invalidValues.forEach(value => {
                    mockConfig.get.mockImplementation((k: string) => {
                        if (k === key) return value;
                        return undefined;
                    });
                    
                    const config = ConfigService.getInstance().getConfig();
                    expect((config as any)[key]).toBe((defaultConfig as any)[key]);
                    
                    ConfigService.resetInstance();
                });
            });
        });
    });

    describe('パフォーマンス', () => {
        test('同じ設定を複数回取得しても効率的であること', () => {
            const configService = ConfigService.getInstance();
            
            const start = Date.now();
            for (let i = 0; i < 100; i++) {
                configService.getConfig();
            }
            const end = Date.now();
            
            // 100回の呼び出しが100ms以内で完了すること
            expect(end - start).toBeLessThan(100);
        });

        test('大量の設定項目があっても効率的に処理されること', () => {
            // 100個の除外パターンを設定
            const largeExcludePatterns = Array.from({ length: 100 }, (_, i) => `pattern${i}/**`);
            
            mockConfig.get.mockImplementation((key: string) => {
                if (key === 'excludePatterns') return largeExcludePatterns;
                return undefined;
            });
            
            const start = Date.now();
            const config = ConfigService.getInstance().getConfig();
            const end = Date.now();
            
            // ユーザーパターンがすべて含まれる
            largeExcludePatterns.forEach(pattern => {
                expect(config.excludePatterns).toContain(pattern);
            });
            // デフォルトパターンも含まれる
            expect(config.excludePatterns).toContain('node_modules/**');
            expect(end - start).toBeLessThan(50); // 50ms以内
        });
    });

    describe('エラー処理', () => {
        test('設定取得中にエラーが発生してもフォールバックされること', () => {
            mockConfig.get.mockImplementation(() => {
                throw new Error('Mock error');
            });
            
            const config = ConfigService.getInstance().getConfig();
            
            // デフォルト設定が返される
            expect(config).toEqual(defaultConfig);
        });

        test('部分的な設定エラーでも正常な項目は反映されること', () => {
            let callCount = 0;
            mockConfig.get.mockImplementation((key: string) => {
                callCount++;
                if (key === 'maxFileSize') {
                    if (callCount === 1) throw new Error('First call error');
                    return 2048;
                }
                if (key === 'chatGptIntegration') return true;
                return undefined;
            });
            
            const config = ConfigService.getInstance().getConfig();
            
            // エラーが発生した設定はデフォルト値
            expect(config.maxFileSize).toBe(defaultConfig.maxFileSize);
            // 正常な設定は反映される
            expect(config.chatGptIntegration).toBe(true);
        });
    });
}); 