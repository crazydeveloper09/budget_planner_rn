import { api } from "../api/client";
import { decryptReceipt, encryptReceipt, ReceiptPlaintext } from "../crypto/e2e";
import { requireDek } from "../crypto/keystore";
import { Transaction } from "../db/interfaces";
import {
  clearReceiptTombstone,
  getReceipt,
  insertReceipt,
  listReceipts,
  listReceiptTombstones,
  rematchReceipts,
  removeReceipt,
} from "../db/receipts";
import { readReceiptBase64, writeReceiptBase64 } from "../helpers/receiptFiles";

type RemoteReceiptIndex = {
  id: string;
  deleted: boolean;
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
  await api.put(`/households/receipts/${payload.id}`, envelope, { timeout: RECEIPT_TIMEOUT_MS });
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
    if (existing && !existing.deleted) continue;
    const image = await readReceiptBase64(receipt.uri);
    if (!image) continue;
    await uploadReceipt({
      id: receipt.id,
      date: receipt.date,
      name: receipt.name,
      category: receipt.category,
      amount: receipt.amount,
      ownerName: receipt.ownerName,
      createdAt: receipt.createdAt,
      image,
    });
  }
}

export async function downloadRemoteReceipts(userId: number, entries: Transaction[]) {
  const remote = await listRemoteReceipts();
  const tombstones = new Set(await listReceiptTombstones());

  for (const item of remote) {
    if (item.deleted) {
      const local = await getReceipt(item.id);
      if (local) await removeReceipt(item.id, { tombstone: false });
      continue;
    }
    if (tombstones.has(item.id)) continue;
    const local = await getReceipt(item.id);
    if (local) continue;
    try {
      const payload = await downloadReceipt(item.id);
      if (!payload?.image) continue;
      const stored = await writeReceiptBase64(payload.id, payload.image);
      await insertReceipt(userId, {
        id: payload.id,
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
