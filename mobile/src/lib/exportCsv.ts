import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { CanonicalReport } from './canonical';
import { ReportMeta, toCsv } from './csv';

/**
 * Write the month's report to a file and hand it to the share sheet (FR-16).
 *
 * This is what makes a seal mean anything to someone else. A fingerprint sent
 * on its own is circular — it comes from the person being checked. With the
 * rows in hand the reviewer recomputes the hash themselves and compares it to
 * the chain, trusting nothing the claimant said.
 */
export async function shareReportCsv(
  report: CanonicalReport,
  meta: ReportMeta,
): Promise<{ shared: boolean; uri: string }> {
  const csv = toCsv(report, meta);
  // Named for the reviewer's inbox, not for the filesystem.
  const name = `snapclaim-${report.month}${meta.version ? `-v${meta.version}` : ''}.csv`;
  const uri = `${cacheDirectory}${name}`;

  await writeAsStringAsync(uri, csv);

  if (!(await isAvailableAsync())) {
    // Sharing is unavailable on some devices; the file still exists and the
    // caller can tell the user where it is rather than failing silently.
    return { shared: false, uri };
  }

  await shareAsync(uri, {
    mimeType: 'text/csv',
    dialogTitle: `SnapClaim report — ${report.month}`,
    UTI: 'public.comma-separated-values-text',
  });
  return { shared: true, uri };
}
