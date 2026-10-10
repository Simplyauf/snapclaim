/**
 * The report file a claimant hands to a reviewer.
 *
 * PURE AND PORTABLE, like canonical.ts — the browser verify page runs this
 * same code. The point of the file is that a reviewer can rebuild the
 * fingerprint THEMSELVES from the expense lines. A fingerprint sent on its
 * own proves nothing: it comes from the person being checked, so it only
 * shows they sealed something, not that this list is what they sealed.
 *
 * Metadata rides in leading `#` comment lines so the file still opens as a
 * normal spreadsheet, and the data rows stay plain CSV.
 */
import { CanonicalExpense, CanonicalReport, formatMinor, normCurrency } from './canonical';

export const CSV_VERSION = 'snapclaim/csv/v1';

/**
 * RFC4180 quoting, with line breaks collapsed to spaces first.
 *
 * Embedded newlines are legal inside quoted CSV, but they make a row span
 * several physical lines, which breaks line-oriented parsing in this file and
 * in whatever spreadsheet the reviewer opens. Collapsing is safe here and
 * cannot alter the fingerprint: canonicalize() already normalises every run
 * of whitespace to a single space before hashing.
 */
function csvCell(value: string): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  return /[",]/.test(flat) ? `"${flat.replace(/"/g, '""')}"` : flat;
}

export type ReportMeta = {
  fingerprint: string;
  signature?: string;
  cluster?: string;
  version?: number;
};

export function toCsv(report: CanonicalReport, meta: ReportMeta): string {
  const rows: string[] = [
    `# ${CSV_VERSION}`,
    `# month,${report.month}`,
    `# owner,${report.owner}`,
    `# fingerprint,${meta.fingerprint}`,
  ];
  if (meta.signature) rows.push(`# transaction,${meta.signature}`);
  if (meta.cluster) rows.push(`# cluster,${meta.cluster}`);
  if (meta.version != null) rows.push(`# version,${meta.version}`);
  rows.push(
    '# Verify at https://snapclaim.maemate.com/verify — the page rebuilds the',
    '# fingerprint from the rows below and compares it against the blockchain.',
    'date,vendor,subtotal,tax,total,currency',
  );

  for (const e of report.expenses) {
    rows.push(
      [
        e.date,
        csvCell(e.vendor),
        e.subtotal === null ? '' : formatMinor(e.subtotal),
        e.tax === null ? '' : formatMinor(e.tax),
        formatMinor(e.total),
        normCurrency(e.currency),
      ].join(','),
    );
  }
  return rows.join('\n') + '\n';
}

/** Split one CSV line, honouring quotes. */
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
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Fixed-decimal string back to integer minor units, without floats. */
function minorFromDecimal(value: string): number | null {
  const t = value.trim();
  if (!t) return null;
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(t);
  if (!m) return null;
  const frac = (m[3] ?? '').padEnd(2, '0');
  const minor = Number(m[2]) * 100 + Number(frac);
  return m[1] === '-' ? -minor : minor;
}

export type ParsedCsv = {
  report: CanonicalReport;
  meta: ReportMeta & { month: string; owner: string };
};

/**
 * Rebuild a report from the CSV a claimant sent. Throws with a plain message
 * the reviewer can act on — this runs in front of someone who did not write
 * the file and cannot debug it.
 */
export function fromCsv(text: string): ParsedCsv {
  const lines = text.split(/\r?\n/);
  const meta: Record<string, string> = {};

  for (const line of lines) {
    const m = /^#\s*([a-z]+),(.*)$/i.exec(line.trim());
    if (m) meta[m[1].toLowerCase()] = m[2].trim();
  }

  const headerIndex = lines.findIndex((l) => /^date,vendor,subtotal,tax,total,currency/i.test(l.trim()));
  if (headerIndex === -1) {
    throw new Error('This file is missing its column header. Is it a SnapClaim report?');
  }
  if (!meta.month) throw new Error('This file does not say which month it covers.');
  if (!meta.owner) throw new Error('This file does not say which wallet it belongs to.');

  const expenses: CanonicalExpense[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const cells = splitCsvLine(raw);
    if (cells.length < 6) {
      throw new Error(`Line ${i + 1} has ${cells.length} columns, expected 6.`);
    }
    const [date, vendor, subtotal, tax, total, currency] = cells;
    const totalMinor = minorFromDecimal(total);
    if (totalMinor === null) {
      throw new Error(`Line ${i + 1} has an amount that is not a number: "${total}".`);
    }
    expenses.push({
      date: date.trim(),
      vendor,
      subtotal: minorFromDecimal(subtotal),
      tax: minorFromDecimal(tax),
      total: totalMinor,
      currency: currency.trim(),
    });
  }

  if (expenses.length === 0) throw new Error('This file has no expense rows.');

  return {
    report: { month: meta.month, owner: meta.owner, expenses },
    meta: {
      month: meta.month,
      owner: meta.owner,
      fingerprint: meta.fingerprint ?? '',
      signature: meta.transaction || undefined,
      cluster: meta.cluster || undefined,
      version: meta.version ? Number(meta.version) : undefined,
    },
  };
}
