/** LZ77 二元组：字面量，或 (长度, 偏移) 引用；text 为引用实际还原的明文 */
export type Lz77Token =
  | {kind: 'literal'; char: string}
  | {kind: 'ref'; length: number; offset: number; text: string};

/**
 * 最短可复用匹配长度（DEFLATE / gzip：length ∈ [3, 258]）。
 * 短于该值一律按字面量输出。
 */
export const MIN_MATCH_LENGTH = 3;

/** 字面量 */
export const TOKEN_COLOR_LITERAL = '#ff6b6b';
/** 最短合法引用：length === 3 */
export const TOKEN_COLOR_SHORT = '#ffe08a';
/** 更长引用：length > 3 */
export const TOKEN_COLOR_LONG = '#3dd6c6';
/** 未归类兜底 */
export const TOKEN_COLOR_DEFAULT = '#e8eef7';

const NEWLINE_GLYPH = '↩︎';

/** 显示用字符（空格/换行替换） */
export function formatDisplayChar(ch: string): string {
  if (ch === '') return 'ε';
  if (ch === '\n' || ch === '\r') return NEWLINE_GLYPH;
  if (ch === ' ') return '␣';
  return ch;
}

/**
 * 二元组强调色：
 * - 字面量 → 红
 * - 引用且 length=3 → 黄
 * - 引用且 length>3 → 绿
 */
export function lz77TokenAccent(token: Lz77Token): string {
  if (token.kind === 'literal') return TOKEN_COLOR_LITERAL;
  if (token.length === MIN_MATCH_LENGTH) return TOKEN_COLOR_SHORT;
  if (token.length > MIN_MATCH_LENGTH) return TOKEN_COLOR_LONG;
  return TOKEN_COLOR_DEFAULT;
}

/** 气泡 / 飞入文案：字面量 'a' 或 (长度, 偏移) */
export function formatTokenLabel(token: Lz77Token): string {
  if (token.kind === 'literal') {
    return `'${formatDisplayChar(token.char)}'`;
  }
  return `(${token.length}, ${token.offset})`;
}

/**
 * 按解码顺序展开全部引用 token，得到各自对应的明文片段。
 * 优先使用编码时写入的 text；否则按 (length, offset) 从缓冲区还原
 *（支持 length > offset 的自重叠，与 Lz77DecodeBoard 一致）。
 */
export function resolveRefExpansions(tokens: Lz77Token[]): string[] {
  const buf: string[] = [];
  const expansions: string[] = [];

  for (const token of tokens) {
    if (token.kind === 'literal') {
      buf.push(token.char);
      continue;
    }

    if (token.text.length === token.length) {
      for (const ch of token.text) buf.push(ch);
      expansions.push(token.text);
      continue;
    }

    const start = buf.length - token.offset;
    let chunk = '';
    for (let i = 0; i < token.length; i++) {
      const ch = buf[start + i];
      chunk += ch;
      buf.push(ch);
    }
    expansions.push(chunk);
  }

  return expansions;
}

/** 展开串的显示文案（空格/换行替换） */
export function formatExpansionLabel(text: string): string {
  return [...text].map(formatDisplayChar).join('');
}

/**
 * 纯函数计算给定文本的 LZ77 二元组序列（算法与 Lz77Board 完全一致）。
 */
export function encodeLz77Tokens(
  text: string,
  windowSize = 12,
  lookAheadSize = 8,
): Lz77Token[] {
  const chars = [...text];
  const tokens: Lz77Token[] = [];
  let cursor = 0;

  while (cursor < chars.length) {
    const searchFrom = Math.max(0, cursor - windowSize);
    let bestLen = 0;
    let bestOffset = 0;
    const maxLen = Math.min(lookAheadSize, chars.length - cursor);

    for (let i = searchFrom; i < cursor; i++) {
      let len = 0;
      const limit = Math.min(maxLen, chars.length - i);
      while (len < limit && chars[i + len] === chars[cursor + len]) {
        len++;
      }
      if (
        len > bestLen ||
        (len === bestLen && len > 0 && i > cursor - bestOffset)
      ) {
        bestLen = len;
        bestOffset = cursor - i;
      }
    }

    if (bestLen >= MIN_MATCH_LENGTH) {
      const chunk = chars.slice(cursor, cursor + bestLen).join('');
      tokens.push({
        kind: 'ref',
        length: bestLen,
        offset: bestOffset,
        text: chunk,
      });
      cursor += bestLen;
    } else {
      tokens.push({kind: 'literal', char: chars[cursor]});
      cursor += 1;
    }
  }

  return tokens;
}
