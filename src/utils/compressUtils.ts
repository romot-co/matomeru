import { ParserManager } from '../services/parserManager';
import { ExtensionContext } from 'vscode';
import { Logger } from './logger';
import type { Tree as WebTreeSitterTree } from 'web-tree-sitter';
import { transform } from 'esbuild';

const logger = Logger.getInstance('CompressUtils');

type WebTreeSitterSyntaxNode = WebTreeSitterTree['rootNode'];

type RemovalRange = { start: number; end: number };
type JsLikeLoader = 'js' | 'ts' | 'jsx' | 'tsx';

const JS_LIKE_LANG_TO_LOADER: Record<string, JsLikeLoader> = {
  javascript: 'js',
  typescript: 'ts',
  tsx: 'tsx',
  jsx: 'jsx',
  javascriptreact: 'jsx',
  typescriptreact: 'tsx'
};

/**
 * インデント依存言語かどうかを判定
 */
function isIndentDependentLanguage(langId: string): boolean {
  return ['python', 'yaml', 'yml', 'makefile', 'make'].includes(langId.toLowerCase());
}

function isTypeScriptLikeLanguage(langId: string): boolean {
  const normalized = langId.toLowerCase();
  return normalized === 'typescript' || normalized === 'tsx' || normalized === 'typescriptreact';
}

function resolveJsLikeLoader(langId: string): JsLikeLoader | undefined {
  return JS_LIKE_LANG_TO_LOADER[langId.toLowerCase()];
}

export async function minifyJsTsRuntimeEquivalent(code: string, langId: string): Promise<string> {
  const loader = resolveJsLikeLoader(langId);
  if (!loader || !code.trim()) {
    return code;
  }

  try {
    const output = await transform(code, {
      loader,
      format: 'esm',
      minify: true,
      legalComments: 'none',
      charset: 'utf8',
      target: 'es2018',
      logLevel: 'silent',
      drop: ['console', 'debugger'],
      pure: ['console.log', 'console.info', 'console.debug']
    });
    return output.code.trim();
  } catch (error) {
    logger.warn(`Failed to minify ${langId} via esbuild: ${error instanceof Error ? error.message : String(error)}`);
    return code;
  }
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
    // インデント依存言語: 余分な空行のみ削除、インデントは保持
    return code
      .split('\n')
      .map(line => line.trimEnd()) // 行末の余分な空白のみ削除
      .join('\n')
      .replace(/\n\s*\n\s*\n/g, '\n\n') // 3つ以上の連続改行を2つに
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
    // インデント依存言語: 余分な空行のみ削除、インデントは保持
    return segment
      .split('\n')
      .map(line => line.trimEnd()) // 行末の余分な空白のみ削除
      .join('\n')
      .replace(/\n\s*\n\s*\n/g, '\n\n'); // 3つ以上の連続改行を2つに
  } else {
    // その他の言語: 連続空白を1文字に、改行を空白に変換し、句読点まわりをタイトにする
    let result = segment
      .replace(/[ \t\u00A0]+/g, ' ')  // 連続空白を1文字に
      .replace(/\s*\n+\s*/g, ' ');   // 改行とその前後の空白を1空白に

    // 代入・演算子周辺の余分な空白を削除
    result = result.replace(/\s+([=+*%<>!&|^~?:-])/g, '$1');
    result = result.replace(/([=+*%<>!&|^~?:-])\s+/g, '$1');
    result = result.replace(/\s*\/\s*/g, '/');

    // カンマやセミコロンの直前直後の空白を削減
    result = result.replace(/\s*,\s*/g, ',');
    result = result.replace(/\s*;\s*/g, ';');

    // 追加で二重スペースを排除
    result = result.replace(/ {2,}/g, ' ');

    return result.trim();
  }
}

function collectAdditionalRemovalRanges(
  root: WebTreeSitterSyntaxNode,
  langId: string,
  code: string
): RemovalRange[] {
  if (langId !== 'python') {
    return [];
  }

  const ranges: RemovalRange[] = [];

  const visit = (node: WebTreeSitterSyntaxNode): void => {
    if (!node || !node.namedChildren) {
      return;
    }

    const namedChildren = (Array.isArray(node.namedChildren)
      ? node.namedChildren
      : Array.from(node.namedChildren)) as WebTreeSitterSyntaxNode[];

    if (node.type === 'module') {
      const docNode = findLeadingDocstring(namedChildren);
      if (docNode) {
        ranges.push(expandRangeToWholeLine(docNode.startIndex, docNode.endIndex, code));
      }
    }

    if (node.type === 'function_definition' || node.type === 'class_definition') {
      const body = namedChildren.find(child => child.type === 'block' || child.type === 'suite');
      if (body && body.namedChildren && body.namedChildren.length > 0) {
        const bodyChildren = (Array.isArray(body.namedChildren)
          ? body.namedChildren
          : Array.from(body.namedChildren)) as WebTreeSitterSyntaxNode[];
        const docNode = findLeadingDocstring(bodyChildren);
        if (docNode) {
          ranges.push(expandRangeToWholeLine(docNode.startIndex, docNode.endIndex, code));
        }
      }
    }

    namedChildren.forEach(child => visit(child as WebTreeSitterSyntaxNode));
  };

  visit(root);

  const heuristicRanges = collectPythonDocstringHeuristics(code);
  heuristicRanges.forEach(range => {
    if (!ranges.some(existing => rangesOverlap(existing, range))) {
      ranges.push(range);
    }
  });

  return ranges;
}

function getNamedChildrenArray(node: WebTreeSitterSyntaxNode | undefined): WebTreeSitterSyntaxNode[] {
  if (!node || !node.namedChildren) {
    return [];
  }
  return Array.isArray(node.namedChildren)
    ? (node.namedChildren as WebTreeSitterSyntaxNode[])
    : Array.from(node.namedChildren as Iterable<WebTreeSitterSyntaxNode>);
}

function collectTsTypeRanges(root: WebTreeSitterSyntaxNode, code: string): RemovalRange[] {
  const ranges: RemovalRange[] = [];
  const simpleRemovalTypes = [
    'type_annotation',
    'type_parameters',
    'type_arguments',
    'implements_clause',
    'readonly_modifier',
    'abstract_modifier',
    'override_modifier'
  ];

  const simpleNodes = root.descendantsOfType(simpleRemovalTypes);
  simpleNodes.forEach(node => {
    if (node) {
      ranges.push({ start: node.startIndex, end: node.endIndex });
    }
  });

  const declarationNodes = root.descendantsOfType(['interface_declaration', 'type_alias_declaration']);
  declarationNodes.forEach(node => {
    if (node) {
      ranges.push(expandRangeToWholeLine(node.startIndex, node.endIndex, code));
    }
  });

  const assertionNodes = root.descendantsOfType(['as_expression', 'satisfies_expression']);
  assertionNodes.forEach(node => {
    if (!node) {
      return;
    }
    const expr = getNamedChildrenArray(node)[0];
    if (expr) {
      const start = expr.endIndex;
      if (start < node.endIndex) {
        ranges.push({ start, end: node.endIndex });
      }
    }
  });

  const nonNullNodes = root.descendantsOfType('non_null_expression');
  nonNullNodes.forEach(node => {
    if (!node) {
      return;
    }
    const expr = getNamedChildrenArray(node)[0];
    if (expr) {
      const start = expr.endIndex;
      if (start < node.endIndex) {
        ranges.push({ start, end: node.endIndex });
      }
    }
  });

  const importNodes = root.descendantsOfType('import_statement');
  importNodes.forEach(node => {
    if (!node) return;
    const text = code.slice(node.startIndex, node.endIndex);
    if (/^\s*import\s+type\b/.test(text)) {
      ranges.push(expandRangeToWholeLine(node.startIndex, node.endIndex, code));
    }
  });

  const exportNodes = root.descendantsOfType('export_statement');
  exportNodes.forEach(node => {
    if (!node) return;
    const text = code.slice(node.startIndex, node.endIndex);
    if (/^\s*export\s+type\b/.test(text)) {
      ranges.push(expandRangeToWholeLine(node.startIndex, node.endIndex, code));
    }
  });

  return ranges;
}

function findLeadingDocstring(children: WebTreeSitterSyntaxNode[]): WebTreeSitterSyntaxNode | undefined {
  for (const child of children) {
    if (!child || child.type === 'comment') {
      continue;
    }

    if (child.type === 'expression_statement' && child.namedChildren && child.namedChildren.length === 1) {
      const candidate = child.namedChildren[0] as WebTreeSitterSyntaxNode;
      if (isStringLiteralNode(candidate)) {
        return child;
      }
    }

    break;
  }

  return undefined;
}

function isStringLiteralNode(node: WebTreeSitterSyntaxNode | undefined): boolean {
  if (!node) {
    return false;
  }
  const type = node.type.toLowerCase();
  return type.includes('string');
}

function expandRangeToWholeLine(start: number, end: number, code: string): RemovalRange {
  let rangeStart = start;
  let rangeEnd = end;

  while (rangeStart > 0 && /[ \t]/.test(code[rangeStart - 1])) {
    rangeStart--;
  }

  while (rangeEnd < code.length && /[ \t]/.test(code[rangeEnd])) {
    rangeEnd++;
  }
  if (rangeEnd < code.length && code[rangeEnd] === '\r') {
    rangeEnd++;
    if (rangeEnd < code.length && code[rangeEnd] === '\n') {
      rangeEnd++;
    }
  } else if (rangeEnd < code.length && code[rangeEnd] === '\n') {
    rangeEnd++;
  }

  return { start: rangeStart, end: rangeEnd };
}

function collectPythonDocstringHeuristics(code: string): RemovalRange[] {
  const ranges: RemovalRange[] = [];

  const moduleDocRegex = /^\s*("""[\s\S]*?"""|'''[\s\S]*?'''\s*)(\r?\n)?/;
  const moduleMatch = moduleDocRegex.exec(code);
  if (moduleMatch && moduleMatch.index === 0) {
    const matchText = moduleMatch[0];
    ranges.push({ start: 0, end: matchText.length });
  }

  const docstringRegex = /\n([ \t]+)("""[\s\S]*?"""|'''[\s\S]*?''')/g;
  let match: RegExpExecArray | null;
  while ((match = docstringRegex.exec(code)) !== null) {
    const newlineIndex = match.index;
    const docStart = newlineIndex + 1; // skip newline, remove indent + docstring
    const docEnd = docstringRegex.lastIndex;

    const preceding = code.slice(0, newlineIndex).trimEnd();
    const lastLine = preceding.slice(preceding.lastIndexOf('\n') + 1);
    if (!lastLine.endsWith(':')) {
      continue;
    }

    const rangeStart = docStart;
    let rangeEnd = docEnd;

    // consume trailing whitespace and a single newline after the docstring
    while (rangeEnd < code.length && /[ \t]/.test(code[rangeEnd])) {
      rangeEnd++;
    }
    if (rangeEnd < code.length && code[rangeEnd] === '\r') {
      rangeEnd++;
      if (rangeEnd < code.length && code[rangeEnd] === '\n') {
        rangeEnd++;
      }
    } else if (rangeEnd < code.length && code[rangeEnd] === '\n') {
      rangeEnd++;
    }

    ranges.push({ start: rangeStart, end: rangeEnd });
  }

  return ranges;
}

function rangesOverlap(a: RemovalRange, b: RemovalRange): boolean {
  return a.start < b.end && b.start < a.end;
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
  ctx: ExtensionContext,
  options?: { stripTypes?: boolean }
): Promise<string> {
  try {
    const originalCode = code;
    let workingCode = code;
    let docstringRemovalCount = 0;

    if (langId === 'python') {
      const docstringRanges = collectPythonDocstringHeuristics(workingCode);
      if (docstringRanges.length > 0) {
        workingCode = applyRemovalRanges(workingCode, docstringRanges);
        docstringRemovalCount = docstringRanges.length;
      }
    }

    const parser = await ParserManager.getInstance(ctx).getParser(langId);
    if (!parser) {
      logger.info(`Unsupported language for compression: ${langId}, applying basic whitespace minification`);
      // 対応言語でない場合は基本的な空白圧縮のみ実行
      return basicWhitespaceMinify(workingCode, langId);
    }

    const tree = parser.parse(workingCode);
    // parse に失敗した場合や、tree が null/undefined の場合は基本的な空白圧縮のみ実行
    if (!tree) {
        logger.warn(`Failed to parse ${langId} code, applying basic whitespace minification`);
        return basicWhitespaceMinify(workingCode, langId); 
    }

    const commentNodes = tree.rootNode.descendantsOfType('comment');
    const additionalRanges = collectAdditionalRemovalRanges(tree.rootNode, langId, workingCode);
    const shouldStripTypes = Boolean(options?.stripTypes && isTypeScriptLikeLanguage(langId));
    const typeRanges = shouldStripTypes ? collectTsTypeRanges(tree.rootNode, workingCode) : [];
    
    let result: string;
    
    // コメントがある場合は除去処理を実行
    const rangesToRemove: RemovalRange[] = commentNodes
      ? commentNodes
          .map(node => node ? { start: node.startIndex, end: node.endIndex } : null)
          .filter((range): range is RemovalRange => range !== null)
      : [];

    rangesToRemove.push(...additionalRanges);
    rangesToRemove.push(...typeRanges);

    if (rangesToRemove.length > 0) {
      const sortedRanges = rangesToRemove
        .sort((a, b) => a.start - b.start)
        .reduce<RemovalRange[]>((acc, curr) => {
          const last = acc[acc.length - 1];
          if (last && curr.start <= last.end) {
            last.end = Math.max(last.end, curr.end);
          } else {
            acc.push({ ...curr });
          }
          return acc;
        }, []);

      const pieces: string[] = [];
      let lastIndex = 0;
      for (const range of sortedRanges) {
        // 範囲開始位置までのコード片を追加
        pieces.push(workingCode.slice(lastIndex, range.start));
        // 次の開始位置を範囲の終了位置に設定
        lastIndex = range.end;
      }
      // 最後のコメント以降のコード片を追加
      pieces.push(workingCode.slice(lastIndex));

      result = pieces.join('');
    } else {
      // コメントがない場合はそのまま
      result = workingCode;
    }
    
    // コメント除去後（またはコメントがない場合）に空白・改行を最小化
    result = await minifyWhitespace(result, langId, ctx);
    
    // ログ出力
    const commentsRemoved = commentNodes ? commentNodes.length : 0;
    const totalRemoved = commentsRemoved + docstringRemovalCount;
    const reduction = originalCode.length === 0
      ? 0
      : Math.round((originalCode.length - result.length) / originalCode.length * 100);
    logger.info(`Compressed ${langId} code: removed ${totalRemoved} comment/docstring blocks and minified whitespace (${originalCode.length} → ${result.length} chars, ${reduction}% reduction)`);
    
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

function applyRemovalRanges(source: string, ranges: RemovalRange[]): string {
  if (ranges.length === 0) {
    return source;
  }

  const merged = ranges
    .slice()
    .sort((a, b) => a.start - b.start)
    .reduce<RemovalRange[]>((acc, curr) => {
      const last = acc[acc.length - 1];
      if (last && curr.start <= last.end) {
        last.end = Math.max(last.end, curr.end);
      } else {
        acc.push({ ...curr });
      }
      return acc;
    }, []);

  let result = '';
  let lastIndex = 0;
  for (const range of merged) {
    result += source.slice(lastIndex, range.start);
    lastIndex = Math.max(lastIndex, range.end);
  }
  result += source.slice(lastIndex);

  return result;
}
