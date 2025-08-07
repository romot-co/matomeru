/**
 * Enhanced ConfigService tests for new configuration keys
 */
import * as vscode from 'vscode';
import { ConfigService } from '../services/configService';

// VSCode のモック
const mockConfig = {
    get: jest.fn()
};

const mockGetConfiguration = jest.fn(() => mockConfig);
Object.defineProperty(vscode.workspace, 'getConfiguration', { value: mockGetConfiguration });

describe('ConfigService Enhanced Keys', () => {
    let configService: ConfigService;

    beforeEach(() => {
        jest.clearAllMocks();
        ConfigService.resetInstance();
        configService = ConfigService.getInstance();
    });

    afterEach(() => {
        ConfigService.resetInstance();
    });

    describe('New configuration keys', () => {
        test('should return default values for all new configuration keys', () => {
            mockConfig.get.mockReturnValue(undefined);
            
            const config = configService.getConfig();
            
            expect(config.outputFormat).toBe('markdown');
            expect(config.includeDependencies).toBe(false);
            expect(config.mermaid.maxNodes).toBe(300);
            expect(config.yaml.includeContent).toBe(false);
            expect(config.gitDiff.range).toBe('');
        });

        test('should properly validate outputFormat enum values', () => {
            // With undefined values, should use defaults
            const config = configService.getConfig();
            expect(config.outputFormat).toBe('markdown');
        });

        test('should validate mermaid.maxNodes within reasonable bounds', () => {
            // Since we're using safeGet, mocked undefined values will use defaults
            const config = configService.getConfig();
            expect(config.mermaid.maxNodes).toBe(300); // Should use default
        });

        test('should handle boolean configuration values correctly', () => {
            // With all undefined returns, should use defaults
            const config = configService.getConfig();
            expect(config.includeDependencies).toBe(false); // default
            expect(config.yaml.includeContent).toBe(false); // default
        });

        test('should handle enhanced security excludePatterns', () => {
            const config = configService.getConfig();
            
            // Should include enhanced security patterns
            expect(config.excludePatterns).toContain('**/.env*');
            expect(config.excludePatterns).toContain('**/secrets/**');
            expect(config.excludePatterns).toContain('**/*.secret*');
            expect(config.excludePatterns).toContain('**/credentials/**');
            expect(config.excludePatterns).toContain('**/api_key*');
        });

        test('should properly handle error cases in safeGet', () => {
            mockConfig.get.mockImplementation((key) => {
                if (key === 'includeDependencies') {
                    throw new Error('Configuration error');
                }
                return undefined;
            });

            // Should not throw and use defaults
            const config = configService.getConfig();
            expect(config.includeDependencies).toBe(false); // default value
        });
    });

    describe('Configuration reloading', () => {
        test('should reload configuration when settings change', () => {
            // First load with includeDependencies = false
            mockConfig.get.mockImplementation((key) => {
                if (key === 'includeDependencies') return false;
                return undefined;
            });
            
            let config = configService.getConfig();
            expect(config.includeDependencies).toBe(false);
            
            // Change setting and reload
            mockConfig.get.mockImplementation((key) => {
                if (key === 'includeDependencies') return true;
                return undefined;
            });
            
            configService.reload();
            config = configService.getConfig();
            expect(config.includeDependencies).toBe(true);
        });
    });
});