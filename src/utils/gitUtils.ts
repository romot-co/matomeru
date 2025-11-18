import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
import { Logger } from './logger';
import { MatomeruError } from '../errors/errors';

const logger = Logger.getInstance('GitUtils');
const DANGEROUS_TOKEN_PATTERN = /[^-\w./@^~:]/;

function buildGitDiffArgs(range?: string): string[] {
  const args = ['diff', '--name-only'];
  if (!range) {
    return args;
  }

  const tokens = range
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length > 0);

  for (const token of tokens) {
    if (DANGEROUS_TOKEN_PATTERN.test(token)) {
      throw new Error(`Invalid git diff range token: ${token}`);
    }
    args.push(token);
  }

  return args;
}

/**
 * Gitリポジトリでない場合のエラー
 */
export class GitNotRepositoryError extends MatomeruError {
  constructor() {
    super('msg.noGitRepo', vscode.l10n.t('msg.noGitRepo'));
    this.name = 'GitNotRepositoryError';
  }
}

/**
 * Git CLIが見つからない場合のエラー
 */
export class GitCliNotFoundError extends MatomeruError {
  constructor() {
    super('msg.gitCliNotFound', vscode.l10n.t('msg.gitCliNotFound'));
    this.name = 'GitCliNotFoundError';
  }
}

/**
 * 変更のあるファイルのURIリストを取得する
 * @param cwd カレントワークディレクトリ（通常はワークスペースルート）
 * @param range リビジョン範囲（例: "HEAD~3..HEAD"）、指定がなければワークツリーとHEADの差分
 * @returns 変更のあるファイルのURIリスト
 */
export async function collectChangedFiles(
  cwd: string,
  range?: string
): Promise<vscode.Uri[]> {
  try {
    const args = buildGitDiffArgs(range?.trim());
    logger.info(`実行: git ${args.join(' ')} in ${cwd}`);

    const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn('git', args, { cwd });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', data => {
        stdout += data.toString();
      });

      child.stderr.on('data', data => {
        stderr += data.toString();
      });

      child.on('error', error => {
        reject(error);
      });

      child.on('close', code => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          const error = new Error(stderr || `git exited with code ${code}`);
          (error as any).code = code;
          reject(error);
        }
      });
    });

    if (stderr && stderr.toLowerCase().includes('not a git repository')) {
      throw new GitNotRepositoryError();
    }

    if (stderr) {
      logger.warn(`Git警告: ${stderr}`, { silent: true });
    }

    const files = stdout
      .split('\n')
      .filter(Boolean)
      .map(f => vscode.Uri.file(path.join(cwd, f)));
    
    logger.info(`変更ファイル数: ${files.length}`);
    return files;
  } catch (error) {
    // エラーの種類判別
    if (error instanceof GitNotRepositoryError) {
      throw error;
    }
    
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      
      // Git CLIが見つからない場合
      if (errorMessage.includes('command not found') || 
          errorMessage.includes('not recognized') ||
          errorMessage.includes('no such file') ||
          (error as any).code === 'ENOENT') {
        throw new GitCliNotFoundError();
      }
      
      // Gitリポジトリでない場合
      if (errorMessage.includes('not a git repository')) {
        throw new GitNotRepositoryError();
      }
    }

    // その他のエラー
    logger.error(`Git差分取得中にエラー: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
} 
