import { ParserManager } from '../services/parserManager';
import { ExtensionContext } from 'vscode';
import { Logger } from './logger';

const logger = Logger.getInstance('CompressUtils');

/**
 * Tree-sitterを使用してコードからコメントを除去する
 * @param code 元のコード
 * @param langId 言語ID
 * @param ctx 拡張機能のコンテキスト
 * @returns コメントが除去されたコード
 */
export async function stripComments(
  code: string,
  langId: string,
  ctx: ExtensionContext
): Promise<string> {
  try {
    const parser = await ParserManager.getInstance(ctx).getParser(langId);
    if (!parser) {
      logger.info(`Unsupported language for compression: ${langId}`);
      return code; // 対応言語でない場合はそのまま返す
    }

    const tree = parser.parse(code);
    // parse に失敗した場合や、tree が null/undefined の場合は元コードを返す
    if (!tree) {
        logger.warn(`Failed to parse ${langId} code.`);
        return code; 
    }

    const commentNodes = tree.rootNode.descendantsOfType('comment');
    // コメントがない場合はそのまま返す
    if (!commentNodes || commentNodes.length === 0) {
        return code;
    }

    // コメント範囲をソート (開始インデックス昇順) と null/undefined の除去
    const commentRanges = commentNodes
      .map(node => node ? { start: node.startIndex, end: node.endIndex } : null) // node が null なら null を返す
      .filter((range): range is { start: number; end: number } => range !== null) // null を除去し、型ガードで型を保証
      .sort((a, b) => a.start - b.start);

    const pieces: string[] = [];
    let lastIndex = 0;
    for (const comment of commentRanges) {
      // コメント開始位置までのコード片を追加
      pieces.push(code.slice(lastIndex, comment.start));
      // 次の開始位置をコメントの終了位置に設定
      lastIndex = comment.end;
    }
    // 最後のコメント以降のコード片を追加
    pieces.push(code.slice(lastIndex));

    logger.info(`Removed ${commentNodes.length} comments from ${langId} code`);
    return pieces.join('');

  } catch (error) {
    // エラー内容をより詳細にログ出力
    logger.error(`Error stripping comments for ${langId}: ${error instanceof Error ? error.message : String(error)}`);
    // スタックトレースも出力するとデバッグに役立つ (infoレベルで出力)
    if (error instanceof Error && error.stack) {
        logger.info(error.stack);
    }
    return code; // エラー時はオリジナルをそのまま返す
  }
} 