import { 
  isBinaryFile, 
  formatFileSize, 
  calculateContentMetrics, 
  formatTokenCount 
} from '../utils/fileUtils';
import { TOKENS_PER_BYTE } from '../utils/constants';
import { Buffer } from 'buffer';

// isbinaryfileのモック
import { isBinaryFileSync } from 'isbinaryfile';
jest.mock('isbinaryfile', () => ({
  isBinaryFileSync: jest.fn()
}));

const mockedIsBinaryFileSync = jest.mocked(isBinaryFileSync);

describe('fileUtils', () => {
  describe('isBinaryFile', () => {
    it('バイナリファイルの場合にtrueを返すこと', () => {
      mockedIsBinaryFileSync.mockReturnValue(true);
      
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      const result = isBinaryFile(buffer);
      
      expect(result).toBe(true);
    });

    it('テキストファイルの場合にfalseを返すこと', () => {
      mockedIsBinaryFileSync.mockReturnValue(false);
      
      const buffer = Buffer.from('Hello, World!');
      const result = isBinaryFile(buffer);
      
      expect(result).toBe(false);
    });

    it('文字列も受け入れること', () => {
      mockedIsBinaryFileSync.mockReturnValue(false);
      
      const result = isBinaryFile('Hello, World!');
      
      expect(result).toBe(false);
    });

    it('エラーが発生した場合はfalseを返すこと', () => {
      mockedIsBinaryFileSync.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const result = isBinaryFile(Buffer.from('test'));
      
      expect(result).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('0バイトの場合に正しくフォーマットすること', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });

    it('バイト単位で正しくフォーマットすること', () => {
      expect(formatFileSize(512)).toBe('512 B');
      expect(formatFileSize(1)).toBe('1 B');
    });

    it('KB単位で正しくフォーマットすること', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(2048)).toBe('2.0 KB');
    });

    it('MB単位で正しくフォーマットすること', () => {
      expect(formatFileSize(1048576)).toBe('1.0 MB');
      expect(formatFileSize(1572864)).toBe('1.5 MB');
    });

    it('GB単位で正しくフォーマットすること', () => {
      expect(formatFileSize(1073741824)).toBe('1.0 GB');
    });

    it('小数点以下の桁数を指定できること', () => {
      expect(formatFileSize(1536, 2)).toBe('1.50 KB');
      expect(formatFileSize(1536, 0)).toBe('2 KB');
    });

    it('負の小数点桁数を適切に処理すること', () => {
      expect(formatFileSize(1536, -1)).toBe('2 KB');
    });

    it('非常に大きな小数点桁数を適切に処理すること', () => {
      expect(formatFileSize(1536, 100)).toBe('1.50000000000000000000 KB');
    });
  });

  describe('calculateContentMetrics', () => {
    it('空文字列の場合に適切な値を返すこと', () => {
      const result = calculateContentMetrics('');
      
      expect(result.size).toBe(0);
      expect(result.tokens).toBe(0);
      expect(result.formattedSize).toBe('0 B');
    });

    it('通常のテキストの場合に適切な値を返すこと', () => {
      const content = 'Hello, World!';
      const result = calculateContentMetrics(content);
      
      expect(result.size).toBe(Buffer.byteLength(content, 'utf-8'));
      expect(result.tokens).toBe(Math.ceil(result.size / TOKENS_PER_BYTE));
      expect(result.formattedSize).toBe(formatFileSize(result.size));
    });

    it('日本語テキストの場合に適切な値を返すこと', () => {
      const content = 'こんにちは世界！';
      const result = calculateContentMetrics(content);
      
      // 日本語はUTF-8で3バイト/文字なので適切に計算されるか確認
      expect(result.size).toBe(Buffer.byteLength(content, 'utf-8'));
      expect(result.tokens).toBe(Math.ceil(result.size / TOKENS_PER_BYTE));
    });
  });

  describe('formatTokenCount', () => {
    it('1000未満の場合はそのまま数値を返すこと', () => {
      expect(formatTokenCount(0)).toBe('0');
      expect(formatTokenCount(1)).toBe('1');
      expect(formatTokenCount(999)).toBe('999');
    });

    it('1000以上の場合はK単位で返すこと', () => {
      expect(formatTokenCount(1000)).toBe('1K');
      expect(formatTokenCount(1500)).toBe('1.5K');
      expect(formatTokenCount(2000)).toBe('2K');
    });

    it('小数点以下が0の場合は整数で表示すること', () => {
      expect(formatTokenCount(3000)).toBe('3K');
      expect(formatTokenCount(10000)).toBe('10K');
    });

    it('小数点以下がある場合は1桁まで表示すること', () => {
      expect(formatTokenCount(1100)).toBe('1.1K');
      expect(formatTokenCount(2350)).toBe('2.4K'); // 2.35は2.4に丸められる
      expect(formatTokenCount(1999)).toBe('2.0K'); // 1.999は2.0に丸められる
    });

    it('大きな数値も適切に処理すること', () => {
      expect(formatTokenCount(123456)).toBe('123.5K');
      expect(formatTokenCount(1000000)).toBe('1000K');
    });
  });
}); 