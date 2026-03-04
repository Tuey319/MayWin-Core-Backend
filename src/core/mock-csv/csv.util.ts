import { promises as fs } from 'fs';
import * as path from 'path';

export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

export function parseCsv(content: string): string[][] {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const lines = normalized.split('\n').filter((line) => line.length > 0);
  return lines.map(parseCsvLine);
}

export function toCsvCell(value: unknown): string {
  const raw = value == null ? '' : String(value);
  const escaped = raw.replace(/"/g, '""');
  if (/[",\n]/.test(raw)) return `"${escaped}"`;
  return escaped;
}

export function toCsvLine(cells: unknown[]): string {
  return cells.map((cell) => toCsvCell(cell)).join(',');
}

export async function ensureCsvFile(filePath: string, headerColumns: string[]): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const exists = await fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    const header = `${toCsvLine(headerColumns)}\n`;
    await fs.writeFile(filePath, header, 'utf8');
  }
}
