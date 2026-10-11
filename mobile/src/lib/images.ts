import { deleteAsync, getInfoAsync } from 'expo-file-system/legacy';

/**
 * Delete a receipt image from disk.
 *
 * The first-run screen tells people their receipts are sent to an AI provider
 * and that they can delete them, so removing the row without removing the
 * file would make that a half-truth. Never throws: a missing or already
 * deleted file must not block removing the expense.
 */
export async function deleteImage(uri?: string): Promise<void> {
  if (!uri || !uri.startsWith('file://')) return;
  try {
    const info = await getInfoAsync(uri);
    if (info.exists) await deleteAsync(uri, { idempotent: true });
  } catch {
    // Best effort — the ledger row is what the user asked to remove.
  }
}
