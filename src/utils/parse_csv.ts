/** 解析后的 CSV：表头 + 行对象（数值列尽量转为 number） */
export interface CsvTable {
  headers: string[];
  rows: Record<string, string | number>[];
}

/**
 * 轻量 CSV 解析（首行为表头，支持简单引号字段）。
 * 能转成有限数字的单元格会写成 number，其余保留 string。
 */
export function parseCsv(text: string): CsvTable {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) {
    return {headers: [], rows: []};
  }

  const headers = splitCsvLine(lines[0]).map(h => h.trim());
  const rows: Record<string, string | number>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row: Record<string, string | number> = {};
    for (let c = 0; c < headers.length; c++) {
      const raw = (cells[c] ?? '').trim();
      const num = Number(raw);
      row[headers[c]] =
        raw !== '' && Number.isFinite(num) ? num : raw;
    }
    rows.push(row);
  }

  return {headers, rows};
}

/** 按逗号拆分一行，支持双引号包裹与内部转义 "" */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** 从行中取数值列；缺失或非有限数返回 null */
export function csvNumber(
  row: Record<string, string | number>,
  column: string,
): number | null {
  const v = row[column];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
