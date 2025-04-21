import * as vscode from 'vscode';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { Logger } from './logger';
import { MatomeruError } from '../errors/errors';

const execAsync = promisify(exec);
const logger = Logger.getInstance('GitUtils');

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
    const command = range 
      ? `git diff --name-only ${range}`
      : 'git diff --name-only';
    
    logger.info(`実行: ${command} in ${cwd}`);
    
    const { stdout, stderr } = await execAsync(command, { cwd });
    
    if (stderr && stderr.toLowerCase().includes('not a git repository')) {
      throw new GitNotRepositoryError();
    }
    
    if (stderr) {
      logger.warn(`Git警告: ${stderr}`);
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
          errorMessage.includes('no such file')) {
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