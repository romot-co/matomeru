import * as utils from '../utils/fileUtils';
import { Buffer } from 'buffer';

describe('isBinaryFile', () => {
  test('バイナリデータを正しく判定する', () => {
    // バイナリデータをシミュレート
    const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF]);
    expect(utils.isBinaryFile(buffer)).toBe(true);
  });

  test('テキストデータをバイナリと判定しない', () => {
    const text = 'これはテキストデータです。';
    expect(utils.isBinaryFile(text)).toBe(false);
  });

  test('エラーが発生した場合はfalseを返す', () => {
    // モックでエラーを発生させる
    jest.spyOn(Buffer, 'isBuffer').mockImplementationOnce(() => {
      throw new Error('テスト用エラー');
    });
    expect(utils.isBinaryFile('test')).toBe(false);
  });
});

describe('formatFileSize', () => {
  test('0バイトを正しくフォーマットする', () => {
    expect(utils.formatFileSize(0)).toBe('0 B');
  });

  test('バイト単位を正しくフォーマットする', () => {
    expect(utils.formatFileSize(123)).toBe('123 B');
    expect(utils.formatFileSize(1023)).toBe('1023 B');
  });

  test('KB単位を正しくフォーマットする', () => {
    expect(utils.formatFileSize(1024)).toBe('1.0 KB');
    expect(utils.formatFileSize(1536)).toBe('1.5 KB');
    expect(utils.formatFileSize(10240)).toBe('10.0 KB');
  });

  test('MB単位を正しくフォーマットする', () => {
    expect(utils.formatFileSize(1048576)).toBe('1.0 MB');
    expect(utils.formatFileSize(1572864)).toBe('1.5 MB');
  });

  test('GB単位を正しくフォーマットする', () => {
    expect(utils.formatFileSize(1073741824)).toBe('1.0 GB');
  });

  test('小数点以下の桁数を指定できる', () => {
    expect(utils.formatFileSize(1398101, 0)).toBe('1 MB');
    expect(utils.formatFileSize(1398101, 2)).toBe('1.33 MB');
    expect(utils.formatFileSize(1398101, 3)).toBe('1.333 MB');
  });
});

describe('formatTokenCount', () => {
  test('1000未満のトークン数はそのまま表示する', () => {
    expect(utils.formatTokenCount(0)).toBe('0');
    expect(utils.formatTokenCount(1)).toBe('1');
    expect(utils.formatTokenCount(123)).toBe('123');
    expect(utils.formatTokenCount(999)).toBe('999');
  });

  test('1000以上のトークン数はK単位で表示する', () => {
    expect(utils.formatTokenCount(1000)).toBe('1K');
    expect(utils.formatTokenCount(1500)).toBe('1.5K');
    expect(utils.formatTokenCount(2000)).toBe('2K');
    expect(utils.formatTokenCount(10500)).toBe('10.5K');
  });

  test('小数点以下が0の場合は整数として表示する', () => {
    expect(utils.formatTokenCount(2000)).toBe('2K');
    expect(utils.formatTokenCount(5000)).toBe('5K');
    expect(utils.formatTokenCount(10000)).toBe('10K');
  });

  test('小数点以下がある場合は小数点第1位まで表示する', () => {
    expect(utils.formatTokenCount(1234)).toBe('1.2K');
    expect(utils.formatTokenCount(5678)).toBe('5.7K');
    expect(utils.formatTokenCount(9876)).toBe('9.9K');
  });
});

describe('calculateContentMetrics', () => {
  test('コンテンツのサイズとトークン数を正しく計算する', () => {
    const content = 'これはテストコンテンツです。';
    const metrics = utils.calculateContentMetrics(content);
    
    // バイト数はUTF-8エンコードされたサイズに基づく
    const expectedSize = Buffer.byteLength(content, 'utf-8');
    const expectedTokens = Math.ceil(expectedSize / 4);
    
    expect(metrics.size).toBe(expectedSize);
    expect(metrics.tokens).toBe(expectedTokens);
    expect(metrics.formattedSize).toBe(utils.formatFileSize(expectedSize));
  });

  test('空のコンテンツを正しく処理する', () => {
    const metrics = utils.calculateContentMetrics('');
    
    expect(metrics.size).toBe(0);
    expect(metrics.tokens).toBe(0);
    expect(metrics.formattedSize).toBe('0 B');
  });
}); 