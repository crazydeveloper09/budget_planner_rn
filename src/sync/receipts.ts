import { api } from "../api/client";
import { decryptReceipt, encryptReceipt, ReceiptPlaintext } from "../crypto/e2e";
import { requireDek } from "../crypto/keystore";
import { Transaction } from "../db/interfaces";
import {
  applyReceiptDetails,
  clearReceiptTombstone,
  getReceipt,
  insertReceipt,
  listReceipts,
  listReceiptTombstones,
  markReceiptSynced,
  receiptSyncVersions,
  rematchReceipts,
  removeReceipt,
} from "../db/receipts";
import { readReceiptBase64, writeReceiptBase64 } from "../helpers/receiptFiles";

type RemoteReceiptIndex = {
  id: string;
  deleted: boolean;
  updatedAt: string;
};

const RECEIPT_TIMEOUT_MS = 60_000;

async function listRemoteReceipts(): Promise<RemoteReceiptIndex[]> {
  const { data } = await api.get<{ receipts: RemoteReceiptIndex[] }>("/households/receipts", {
    timeout: RECEIPT_TIMEOUT_MS,
  });
  return data.receipts ?? [];
}

async function uploadReceipt(payload: ReceiptPlaintext) {
  const dek = await requireDek();
  const envelope = encryptReceipt(dek, payload);
  const { data } = await api.put<{ updatedAt?: string }>(`/households/receipts/${payload.id}`, envelope, { timeout: RECEIPT_TIMEOUT_MS });
  return data.updatedAt ?? null;
}

async function downloadReceipt(id: string): Promise<ReceiptPlaintext | null> {
  const dek = await requireDek();
  const { data } = await api.get<{ nonce: string; ciphertext: string }>(`/households/receipts/${id}`, {
    timeout: RECEIPT_TIMEOUT_MS,
  });
  if (!data?.nonce || !data?.ciphertext) return null;
  return decryptReceipt(dek, data);
}

export async function uploadLocalReceipts(userId: number) {
  const versions = await receiptSyncVersions(userId);
  const local = await listReceipts(userId);
  const remote = await listRemoteReceipts();
  const remoteById = new Map(remote.map((item) => [item.id, item]));
  const tombstones = await listReceiptTombstones();

  for (const id of tombstones) {
    try {
      await api.delete(`/households/receipts/${id}`, { timeout: RECEIPT_TIMEOUT_MS });
      await clearReceiptTombstone(id);
    } catch {
      // retry next sync
    }
  }

  for (const receipt of local) {
    if (tombstones.includes(receipt.id)) continue;
    const existing = remoteById.get(receipt.id);
    const version = versions.get(receipt.id) ?? null;
    if (existing?.deleted || (existing && !version?.startsWith("pending:"))) continue;
    const image = await readReceiptBase64(receipt.uri);
    if (!image) continue;
    const updatedAt = await uploadReceipt({
      id: receipt.id,
      standalone: receipt.standalone,
      date: receipt.date,
      name: receipt.name,
      category: receipt.category,
      amount: receipt.amount,
      ownerName: receipt.ownerName,
      createdAt: receipt.createdAt,
      image,
    });
    await markReceiptSynced(receipt.id, version, updatedAt);
  }
}

export async function downloadRemoteReceipts(userId: number, entries: Transaction[]) {
  const pending = await receiptSyncVersions(userId);
  if (Array.from(pending.values()).some((version) => version?.startsWith("pending:"))) {
    try {
      await uploadLocalReceipts(userId);
    } catch {
      // Preserve pending edits and still pull other receipts.
    }
  }
  const remote = await listRemoteReceipts();
  const tombstones = new Set(await listReceiptTombstones());
  const versions = await receiptSyncVersions(userId);

  for (const item of remote) {
    if (item.deleted) {
      const local = await getReceipt(item.id);
      if (local) await removeReceipt(item.id, { tombstone: false });
      continue;
    }
    if (tombstones.has(item.id)) continue;
    const local = await getReceipt(item.id);
    const version = versions.get(item.id) ?? null;
    if (local && version && (version.startsWith("pending:") || version >= item.updatedAt)) continue;
    try {
      const payload = await downloadReceipt(item.id);
      if (!payload?.image) continue;
      if (local) {
        await applyReceiptDetails(item.id, version, item.updatedAt, payload);
        continue;
      }
      const stored = await writeReceiptBase64(payload.id, payload.image);
      await insertReceipt(userId, {
        id: payload.id,
        standalone: payload.standalone,
        entryId: null,
        date: payload.date,
        name: payload.name,
        category: payload.category,
        amount: payload.amount,
        ownerName: payload.ownerName ?? null,
        createdAt: payload.createdAt,
        uri: stored.uri,
        fileName: stored.fileName,
      });
      await markReceiptSynced(item.id, null, item.updatedAt);
    } catch {
      // missing blob is retried on next live pull
    }
  }

  await rematchReceipts(userId, entries);
}

export async function migrateEmbeddedReceipts(
  userId: number,
  embedded: Array<ReceiptPlaintext & { image?: string }>
) {
  for (const item of embedded) {
    if (!item.image) continue;
    const existing = await getReceipt(item.id);
    if (!existing) {
      const stored = await writeReceiptBase64(item.id, item.image);
      await insertReceipt(userId, {
        id: item.id,
        standalone: item.standalone,
        entryId: null,
        date: item.date,
        name: item.name,
        category: item.category,
        amount: item.amount,
        ownerName: item.ownerName ?? null,
        createdAt: item.createdAt,
        uri: stored.uri,
        fileName: stored.fileName,
      });
    }
  }
}
