import { isBinaryFileSync } from 'isbinaryfile';
import { Buffer } from 'buffer';

/**
 * ファイルがバイナリかどうかを判定する
 * @param buffer 判定対象のバッファ
 * @returns バイナリの場合true
 */
export function isBinaryFile(buffer: Buffer | string): boolean {
  try {
    // 文字列の場合はバッファに変換
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    return isBinaryFileSync(buf);
  } catch (error) {
    // エラーが発生した場合は安全のためテキストとして扱う
    return false;
  }
}

/**
 * ファイルサイズを適切な単位（B, KB, MB, GB）で表示する
 * @param bytes バイト数
 * @param decimalPoint 小数点以下の桁数（デフォルト1桁）
 * @returns フォーマットされたサイズ文字列
 */
export function formatFileSize(bytes: number, decimalPoint = 1): string {
  if (bytes === 0) {
    return '0 B';
  }
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  // 0より大きい値で、切り捨てできる範囲にdecimalPointを制限
  const dp = Math.max(0, Math.min(decimalPoint, 20));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dp)) + ' ' + sizes[i];
}

/**
 * コンテンツのサイズとおおよそのトークン数を計算する
 * @param content 計算対象のコンテンツ
 * @returns {size: number, tokens: number, formattedSize: string} サイズ（バイト）、推定トークン数、フォーマット済みサイズ
 */
export function calculateContentMetrics(content: string): { size: number, tokens: number, formattedSize: string } {
  const size = Buffer.byteLength(content, 'utf-8');
  // トークン数を概算（文字バイト数を4で割った値を使用）
  const tokens = Math.ceil(size / 4);
  const formattedSize = formatFileSize(size);
  
  return { size, tokens, formattedSize };
} 