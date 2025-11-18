import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
import { Logger } from './logger';
import { MatomeruError } from '../errors/errors';
import { parseUnifiedDiff } from './gitDiffParser';

const logger = Logger.getInstance('GitUtils');
const UNSAFE_RANGE_TOKEN_PATTERN = /[^-\w./@^~:{}[*]/;

function appendRangeTokens(args: string[], range?: string): void {
  if (!range) {
    return;
  }

  const tokens = range
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length > 0);

  for (const token of tokens) {
    if (UNSAFE_RANGE_TOKEN_PATTERN.test(token)) {
      throw new Error(`Invalid git diff range token: ${token}`);
    }
    args.push(token);
  }
}

export function buildGitDiffArgs(range?: string): string[] {
  const args = ['diff', '--name-only'];
  appendRangeTokens(args, range);
  return args;
}

export function buildGitDiffPatchArgs(range?: string): string[] {
  const args = ['diff', '--unified=0', '--no-color'];
  appendRangeTokens(args, range);
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

    const { stdout, stderr } = await runGitCommand(args, cwd);

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

export interface FileChangedLines {
  uri: vscode.Uri;
  changedLines: Set<number>;
}

export async function collectChangedFilesWithLineInfo(
  cwd: string,
  range?: string
): Promise<Map<string, FileChangedLines>> {
  try {
    const args = buildGitDiffPatchArgs(range?.trim());
    logger.info(`実行: git ${args.join(' ')} in ${cwd}`);

    const { stdout, stderr } = await runGitCommand(args, cwd);

    if (stderr && stderr.toLowerCase().includes('not a git repository')) {
      throw new GitNotRepositoryError();
    }

    if (stderr) {
      logger.warn(`Git警告: ${stderr}`, { silent: true });
    }

    const parsed = parseUnifiedDiff(stdout);
    const results = new Map<string, FileChangedLines>();
    for (const [relativePath, lines] of parsed) {
      const absolutePath = path.normalize(path.join(cwd, relativePath));
      results.set(absolutePath, {
        uri: vscode.Uri.file(absolutePath),
        changedLines: new Set(lines)
      });
    }
    return results;
  } catch (error) {
    if (error instanceof GitNotRepositoryError) {
      throw error;
    }

    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes('command not found') ||
        errorMessage.includes('not recognized') ||
        errorMessage.includes('no such file') ||
        (error as any).code === 'ENOENT') {
        throw new GitCliNotFoundError();
      }

      if (errorMessage.includes('not a git repository')) {
        throw new GitNotRepositoryError();
      }
    }

    logger.error(`Git差分行取得中にエラー: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function runGitCommand(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
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
}
