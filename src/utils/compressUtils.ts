import { ParserManager } from '../services/parserManager';
import { ExtensionContext } from 'vscode';
import { Logger } from './logger';
import * as vscode from 'vscode';

const logger = Logger.getInstance('CompressUtils');

/**
 * インデント依存言語かどうかを判定
 */
function isIndentDependentLanguage(langId: string): boolean {
  return ['python', 'yaml', 'yml', 'makefile', 'make'].includes(langId.toLowerCase());
}

/**
 * コメント除去後のコードから不要な空白・改行を最小化
 * @param code コメント除去済みのコード
 * @param langId 言語ID
 * @param ctx 拡張機能のコンテキスト
 * @returns 空白・改行が最小化されたコード
 */
async function minifyWhitespace(code: string, langId: string, ctx: ExtensionContext): Promise<string> {
  try {
    const parser = await ParserManager.getInstance(ctx).getParser(langId);
    if (!parser) {
      // 対応言語でない場合は基本的な空白圧縮のみ実行
      return basicWhitespaceMinify(code, langId);
    }

    const tree = parser.parse(code);
    if (!tree) {
      return basicWhitespaceMinify(code, langId);
    }

    // 文字列リテラル、テンプレート、正規表現、プリプロセッサ指令を取得
    const preserveNodes = tree.rootNode.descendantsOfType([
      'string', 'raw_string', 'template_string', 'regex', 'preproc_directive',
      'string_literal', 'template_literal', 'regular_expression',
      'quoted_string', 'backtick_string'
    ]).filter(node => node !== null);

    // ノードを開始位置でソート
    preserveNodes.sort((a, b) => a.startIndex - b.startIndex);

    let result = '';
    let lastIndex = 0;

    // 保護する必要があるノードの間の部分を処理
    for (const node of preserveNodes) {
      if (!node) continue;
      const beforeNode = code.slice(lastIndex, node.startIndex);
      result += minifyCodeSegment(beforeNode, langId);
      result += code.slice(node.startIndex, node.endIndex); // ノード内容はそのまま保持
      lastIndex = node.endIndex;
    }

    // 最後のノード以降の部分を処理
    const afterLastNode = code.slice(lastIndex);
    result += minifyCodeSegment(afterLastNode, langId);

    return result.trim();

  } catch (error) {
    logger.warn(`Error minifying whitespace for ${langId}: ${error instanceof Error ? error.message : String(error)}`);
    return basicWhitespaceMinify(code, langId);
  }
}

/**
 * Tree-sitterが利用できない場合の基本的な空白圧縮
 */
function basicWhitespaceMinify(code: string, langId: string): string {
  if (isIndentDependentLanguage(langId)) {
    // インデント依存言語: 行頭空白をタブ1文字に変換、改行は保持
    return code
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        return trimmed ? '\t' + trimmed : trimmed;
      })
      .join('\n')
      .trim();
  } else {
    // その他の言語: 連続空白を1文字に、改行を空白に変換
    return code
      .replace(/[ \t\u00A0]+/g, ' ')  // 連続空白を1文字に
      .replace(/\s*\n+\s*/g, ' ')     // 改行とその前後の空白を1空白に
      .trim();
  }
}

/**
 * コードセグメント（文字列等を除いた部分）の空白を最小化
 */
function minifyCodeSegment(segment: string, langId: string): string {
  if (isIndentDependentLanguage(langId)) {
    // インデント依存言語: 行頭インデントのみ最小化、改行は保持
    return segment
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed) return ''; // 空行はそのまま
        const leadingWhitespace = line.match(/^[ \t]*/)?.[0] || '';
        if (leadingWhitespace.length > 0) {
          return '\t' + trimmed; // インデントがある行は1タブ + 内容
        }
        return trimmed; // インデントがない行はそのまま
      })
      .join('\n');
  } else {
    // その他の言語: 連続空白を1文字に、改行を空白に変換
    return segment
      .replace(/[ \t\u00A0]+/g, ' ')  // 連続空白を1文字に
      .replace(/\s*\n+\s*/g, ' ');    // 改行とその前後の空白を1空白に
  }
}

/**
 * Tree-sitterを使用してコードからコメントを除去し、不要な空白・改行を最小化する
 * @param code 元のコード
 * @param langId 言語ID
 * @param ctx 拡張機能のコンテキスト
 * @returns コメントと不要な空白が除去されたコード
 */
export async function stripComments(
  code: string,
  langId: string,
  ctx: ExtensionContext
): Promise<string> {
  try {
    const parser = await ParserManager.getInstance(ctx).getParser(langId);
    if (!parser) {
      logger.info(`Unsupported language for compression: ${langId}, applying basic whitespace minification`);
      // 対応言語でない場合は基本的な空白圧縮のみ実行
      return basicWhitespaceMinify(code, langId);
    }

    const tree = parser.parse(code);
    // parse に失敗した場合や、tree が null/undefined の場合は基本的な空白圧縮のみ実行
    if (!tree) {
        logger.warn(`Failed to parse ${langId} code, applying basic whitespace minification`);
        return basicWhitespaceMinify(code, langId); 
    }

    const commentNodes = tree.rootNode.descendantsOfType('comment');
    
    let result: string;
    
    // コメントがある場合は除去処理を実行
    if (commentNodes && commentNodes.length > 0) {
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

      result = pieces.join('');
    } else {
      // コメントがない場合はそのまま
      result = code;
    }
    
    // コメント除去後（またはコメントがない場合）に空白・改行を最小化
    result = await minifyWhitespace(result, langId, ctx);
    
    // 詳細なログ出力 (verboseCompression設定がある場合)
    const config = vscode.workspace.getConfiguration('matomeru');
    const commentsRemoved = commentNodes ? commentNodes.length : 0;
    if (config.get('verboseCompression')) {
      logger.info(`Original code (${langId}, ${code.length} chars):\n${code}`);
      logger.info(`Compressed code (${result.length} chars):\n${result}`);
      logger.info(`Removed ${commentsRemoved} comments and minified whitespace, saved ${code.length - result.length} chars`);
    } else {
      logger.info(`Compressed ${langId} code: removed ${commentsRemoved} comments and minified whitespace (${code.length} → ${result.length} chars, ${Math.round((code.length - result.length) / code.length * 100)}% reduction)`);
    }
    
    return result;

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