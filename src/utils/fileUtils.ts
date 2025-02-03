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