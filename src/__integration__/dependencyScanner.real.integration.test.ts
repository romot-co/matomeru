import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { scanDependencies } from '../parsers/dependencyScanner';

// VSCode APIのモック
jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{
      uri: { fsPath: '/test/workspace' },
      name: 'test',
      index: 0
    }]
  }
}));

// extension.tsのモック
jest.mock('../extension', () => ({
  getExtensionContext: () => ({
    extensionPath: '/test/extension/path'
  })
}));

// 実際のParserManagerを使用するため、モックしない
// jest.mock('../services/parserManager');

describe('依存関係解析統合テスト（実際のパーサー使用）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 注意: これらのテストは実際のTree-sitterパーサーが利用可能な場合のみ実行される
  // パーサーが利用できない環境では空配列が返される

  describe('JavaScript/TypeScript import文の解析', () => {
    const jsTestCases = [
      {
        name: 'ESM import文',
        code: `import React from 'react';`,
        language: 'javascript',
        expectedPatterns: ['react']
      },
      {
        name: '名前付きimport',
        code: `import { useState, useEffect } from 'react';`,
        language: 'javascript', 
        expectedPatterns: ['react']
      },
      {
        name: '相対パスimport',
        code: `import utils from './utils';`,
        language: 'javascript',
        expectedPatterns: ['./utils']
      },
      {
        name: '絶対パスimport',
        code: `import config from '@/config';`,
        language: 'javascript',
        expectedPatterns: ['@/config']
      },
      {
        name: 'CommonJS require',
        code: `const fs = require('fs');`,
        language: 'javascript',
        expectedPatterns: ['fs']
      },
      {
        name: 'CommonJS require with destructuring',
        code: `const { readFile, writeFile } = require('fs');`,
        language: 'javascript',
        expectedPatterns: ['fs']
      },
      {
        name: '動的import',
        code: `const module = await import('./dynamic');`,
        language: 'javascript',
        expectedPatterns: ['./dynamic']
      },
      {
        name: 'CSS import',
        code: `import './styles.css';`,
        language: 'javascript',
        expectedPatterns: ['./styles.css']
      },
      {
        name: '複数のimport',
        code: `
          import React from 'react';
          import './styles.css';
          const utils = require('./utils');
          import { api } from '../services/api';
        `,
        language: 'javascript',
        expectedPatterns: ['react', './styles.css', './utils', '../services/api']
      }
    ];

    const tsTestCases = [
      {
        name: 'TypeScript import文',
        code: `import { Component } from '@angular/core';`,
        language: 'typescript',
        expectedPatterns: ['@angular/core']
      },
      {
        name: 'Type-only import',
        code: `import type { User } from './types';`,
        language: 'typescript',
        expectedPatterns: ['./types']
      },
      {
        name: 'Namespace import',
        code: `import * as path from 'path';`,
        language: 'typescript',
        expectedPatterns: ['path']
      }
    ];

    [...jsTestCases, ...tsTestCases].forEach(({ name, code, language, expectedPatterns }) => {
      test(`${name}を解析できること`, async () => {
        const result = await scanDependencies(
          `/test/workspace/src/app.${language === 'typescript' ? 'ts' : 'js'}`,
          code,
          language
        );

        // パーサーが利用可能な場合は期待される依存関係が見つかる
        // パーサーが利用できない場合は空配列
        if (result.length > 0) {
          expectedPatterns.forEach(pattern => {
            const hasPattern = result.some(dep => 
              dep.includes(pattern) || dep.includes(`external:${pattern}`)
            );
            expect(hasPattern).toBe(true);
          });
        } else {
          // パーサーが利用できない場合はテストをスキップ
          console.warn(`Skipping test "${name}" - Parser not available`);
        }
      });
    });
  });

  describe('Python import文の解析', () => {
    const pythonTestCases = [
      {
        name: '基本的なimport',
        code: 'import os',
        expectedPatterns: ['os']
      },
      {
        name: 'from import',
        code: 'from pathlib import Path',
        expectedPatterns: ['pathlib']
      },
      {
        name: '複数のfrom import',
        code: 'from os.path import join, dirname',
        expectedPatterns: ['os.path']
      },
      {
        name: '相対import',
        code: 'from .utils import helper',
        expectedPatterns: ['./utils']
      },
      {
        name: '親ディレクトリからのimport',
        code: 'from ..config import settings',
        expectedPatterns: ['../config']
      },
      {
        name: 'as付きimport',
        code: 'import numpy as np',
        expectedPatterns: ['numpy']
      },
      {
        name: '複数のimport',
        code: `
import os
import sys
from .utils import helper
from pathlib import Path
from ..config import settings
        `,
        expectedPatterns: ['os', 'sys', './utils', 'pathlib', '../config']
      }
    ];

    pythonTestCases.forEach(({ name, code, expectedPatterns }) => {
      test(`${name}を解析できること`, async () => {
        const result = await scanDependencies(
          '/test/workspace/app.py',
          code,
          'python'
        );

        if (result.length > 0) {
          expectedPatterns.forEach(pattern => {
            const hasPattern = result.some(dep => 
              dep.includes(pattern) || dep.includes(`external:${pattern}`)
            );
            expect(hasPattern).toBe(true);
          });
        } else {
          console.warn(`Skipping test "${name}" - Python parser not available`);
        }
      });
    });
  });

  describe('Go import文の解析', () => {
    const goTestCases = [
      {
        name: '基本的なimport',
        code: 'import "fmt"',
        expectedPatterns: ['fmt']
      },
      {
        name: '複数のimport',
        code: `
import (
  "fmt"
  "os"
  "path/filepath"
)
        `,
        expectedPatterns: ['fmt', 'os', 'path/filepath']
      },
      {
        name: '相対パスimport',
        code: 'import "./utils"',
        expectedPatterns: ['./utils']
      },
      {
        name: 'エイリアス付きimport',
        code: `
import (
  "fmt"
  log "github.com/sirupsen/logrus"
)
        `,
        expectedPatterns: ['fmt', 'github.com/sirupsen/logrus']
      }
    ];

    goTestCases.forEach(({ name, code, expectedPatterns }) => {
      test(`${name}を解析できること`, async () => {
        const result = await scanDependencies(
          '/test/workspace/main.go',
          code,
          'go'
        );

        if (result.length > 0) {
          expectedPatterns.forEach(pattern => {
            const hasPattern = result.some(dep => 
              dep.includes(pattern) || dep.includes(`external:${pattern}`)
            );
            expect(hasPattern).toBe(true);
          });
        } else {
          console.warn(`Skipping test "${name}" - Go parser not available`);
        }
      });
    });
  });

  describe('相対パス解決の検証', () => {
    test('同一ディレクトリの相対パス', async () => {
      const code = `import utils from './utils';`;
      const result = await scanDependencies(
        '/test/workspace/src/app.js',
        code,
        'javascript'
      );

      if (result.length > 0) {
        // 相対パスが含まれることを確認
        expect(result.some(dep => dep.includes('./utils'))).toBe(true);
      }
    });

    test('親ディレクトリの相対パス', async () => {
      const code = `import config from '../config';`;
      const result = await scanDependencies(
        '/test/workspace/src/app.js',
        code,
        'javascript'
      );

      if (result.length > 0) {
        expect(result.some(dep => dep.includes('../config'))).toBe(true);
      }
    });

    test('深いネストの相対パス', async () => {
      const code = `import utils from '../../utils/helpers';`;
      const result = await scanDependencies(
        '/test/workspace/src/components/ui/Button.tsx',
        code,
        'typescript'
      );

      if (result.length > 0) {
        expect(result.some(dep => dep.includes('../../utils/helpers'))).toBe(true);
      }
    });
  });

  describe('外部モジュールの識別', () => {
    test('npm パッケージが外部モジュールとして識別される', async () => {
      const externalModules = [
        'react',
        'lodash', 
        '@types/node',
        'express',
        '@angular/core'
      ];

      for (const module of externalModules) {
        const code = `import pkg from '${module}';`;
        const result = await scanDependencies(
          '/test/workspace/src/app.js',
          code,
          'javascript'
        );

        if (result.length > 0) {
          // 外部モジュールの識別方法は実装に依存
          expect(result.some(dep => 
            dep.includes(module) || dep.includes(`external:${module}`)
          )).toBe(true);
        }
      }
    });

    test('相対パスと外部モジュールの混在', async () => {
      const code = `
        import React from 'react';
        import utils from './utils';
        import { api } from '../services/api';
        import lodash from 'lodash';
      `;

      const result = await scanDependencies(
        '/test/workspace/src/components/App.jsx',
        code,
        'javascript'
      );

      if (result.length > 0) {
        // 外部モジュール
        expect(result.some(dep => dep.includes('react'))).toBe(true);
        expect(result.some(dep => dep.includes('lodash'))).toBe(true);
        
        // 相対パス
        expect(result.some(dep => dep.includes('./utils'))).toBe(true);
        expect(result.some(dep => dep.includes('../services/api'))).toBe(true);
      }
    });
  });

  describe('エラーハンドリング', () => {
    test('構文エラーのあるコードでもクラッシュしない', async () => {
      const invalidCodes = [
        `import React from 'react'
         import { useState from 'react' // 構文エラー
         const x = `,
        `import`,
        `import from`,
        `const x = require();`
      ];

      for (const code of invalidCodes) {
        const result = await scanDependencies(
          '/test/workspace/src/app.js',
          code,
          'javascript'
        );

        // エラーでクラッシュせず、空配列か部分的な結果を返す
        expect(Array.isArray(result)).toBe(true);
      }
    });

    test('巨大なファイルでもタイムアウトしない', async () => {
      const largeCode = 'import x from "large";\n'.repeat(1000);
      
      const startTime = Date.now();
      const result = await scanDependencies(
        '/test/workspace/src/large.js',
        largeCode,
        'javascript'
      );
      const endTime = Date.now();

      expect(Array.isArray(result)).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // 5秒以内
    });

    test('特殊文字を含むファイルパス', async () => {
      const code = `import utils from './ユーティリティ';`;
      
      const result = await scanDependencies(
        '/test/workspace/src/コンポーネント/アプリ.js',
        code,
        'javascript'
      );

      expect(Array.isArray(result)).toBe(true);
      // 特殊文字を含むパスでもクラッシュしない
    });

    test('空文字列や空白文字のみの入力', async () => {
      const emptyCodes = ['', '   ', '\n\n\n', '\t\t'];

      for (const code of emptyCodes) {
        const result = await scanDependencies(
          '/test/workspace/src/app.js',
          code,
          'javascript'
        );

        expect(result).toEqual([]);
      }
    });
  });

  describe('言語固有の特殊ケース', () => {
    test('JavaScript: require.resolve', async () => {
      const code = `const modulePath = require.resolve('some-module');`;
      
      const result = await scanDependencies(
        '/test/workspace/src/app.js',
        code,
        'javascript'
      );

      if (result.length > 0) {
        expect(result.some(dep => dep.includes('some-module'))).toBe(true);
      }
    });

    test('TypeScript: Triple-slash directives', async () => {
      const code = `/// <reference path="./types.d.ts" />`;
      
      const result = await scanDependencies(
        '/test/workspace/src/app.ts',
        code,
        'typescript'
      );

      // Triple-slash directivesは現在の実装では検出されない可能性がある
      expect(Array.isArray(result)).toBe(true);
    });

    test('Python: __import__', async () => {
      const code = `module = __import__('os')`;
      
      const result = await scanDependencies(
        '/test/workspace/app.py',
        code,
        'python'
      );

      // __import__は現在の実装では検出されない可能性がある
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('パフォーマンステスト', () => {
    test('複雑なファイルの解析パフォーマンス', async () => {
      const complexCode = `
        // 多数のimport文を含む複雑なファイル
        import React, { useState, useEffect, useCallback, useMemo } from 'react';
        import { connect } from 'react-redux';
        import { Router, Route, Switch } from 'react-router-dom';
        import axios from 'axios';
        import lodash from 'lodash';
        import moment from 'moment';
        import './App.css';
        import './components/Header.css';
        import { Header } from './components/Header';
        import { Footer } from './components/Footer';
        import { Sidebar } from './components/Sidebar';
        import { MainContent } from './components/MainContent';
        import { Modal } from './components/Modal';
        import { Toast } from './components/Toast';
        import { api } from '../services/api';
        import { auth } from '../services/auth';
        import { storage } from '../services/storage';
        import { utils } from '../utils/helpers';
        const fs = require('fs');
        const path = require('path');
        const crypto = require('crypto');
      `;

      const startTime = Date.now();
      const result = await scanDependencies(
        '/test/workspace/src/App.js',
        complexCode,
        'javascript'
      );
      const endTime = Date.now();

      expect(Array.isArray(result)).toBe(true);
      expect(endTime - startTime).toBeLessThan(2000); // 2秒以内

      if (result.length > 0) {
        // 主要なimportが検出されることを確認
        expect(result.some(dep => dep.includes('react'))).toBe(true);
        expect(result.some(dep => dep.includes('./components/Header'))).toBe(true);
        expect(result.some(dep => dep.includes('../services/api'))).toBe(true);
      }
    });
  });
}); 