import * as path from 'path';
import 'module-alias/register';

import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        // テスト実行前の環境設定
        process.env.NODE_ENV = 'test';
        
        // module-aliasの設定
        require('module-alias').addAlias('@', path.join(__dirname, '../../out/src'));

        // テストのルートディレクトリ
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // テストを実行
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
        });
    } catch (err) {
        console.error('テストの実行中にエラーが発生しました:', err);
        process.exit(1);
    }
}

main(); 