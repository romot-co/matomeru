import { isBinaryFileSync } from 'isbinaryfile';
import { Buffer } from 'buffer';

/**
 * バイナリファイルの拡張子リスト
 */
export const BINARY_EXTENSIONS = new Set([
  // 実行ファイル
  '.exe', '.dll', '.so', '.dylib', '.bin',
  // 画像
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.webp', '.tiff',
  // 音声・動画
  '.mp3', '.wav', '.ogg', '.mp4', '.avi', '.mov', '.wmv',
  // アーカイブ
  '.zip', '.tar', '.gz', '.7z', '.rar',
  // ドキュメント
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  // その他
  '.db', '.sqlite', '.class', '.pyc', '.o', '.a'
]);

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