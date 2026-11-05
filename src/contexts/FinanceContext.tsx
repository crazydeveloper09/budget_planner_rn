import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { NewReceipt, NewTransaction, Receipt, Transaction } from "../db/interfaces";
import {
  insertReceipt,
  listReceipts,
  removeReceipt as deleteReceiptRow,
  removeReceiptsForEntry,
  updateReceiptsForEntry,
} from "../db/receipts";
import {
  addTransaction as insertTransaction,
  listTransactions,
  removeTransaction as deleteTransaction,
  updateTransaction,
} from "../db/transactions";
import { persistReceiptFromPicker, receiptsDir } from "../helpers/receiptFiles";
import { ownerLabel } from "../helpers/owners";
import { useAuth } from "./AuthContext";
import { useProfile } from "./ProfileContext";

type FinanceContextValue = {
  entries: Transaction[];
  receipts: Receipt[];
  addEntry: (input: NewTransaction, options?: { receiptUris?: string[] }) => Promise<void>;
  updateEntry: (id: number, input: NewTransaction) => Promise<void>;
  removeEntry: (id: number) => Promise<void>;
  addReceiptsToEntry: (entry: Transaction, sourceUris: string[]) => Promise<void>;
  addStandaloneReceipts: (input: Pick<NewReceipt, "date" | "name" | "category" | "amount" | "ownerName">, sourceUris: string[]) => Promise<void>;
  removeReceipt: (id: string) => Promise<void>;
};

const FinanceContext = createContext<FinanceContextValue | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, members, isReady, ledgerStamp } = useProfile();
  const { pushBudget } = useAuth();
  const [entries, setEntries] = useState<Transaction[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  const reloadLedger = useCallback(async () => {
    if (!profile) {
      setEntries([]);
      setReceipts([]);
      return;
    }
    const [nextEntries, nextReceipts] = await Promise.all([
      listTransactions(profile.id),
      listReceipts(profile.id),
    ]);
    setEntries(nextEntries);
    setReceipts(nextReceipts);
  }, [profile]);

  useEffect(() => {
    if (!isReady || !profile) {
      setEntries([]);
      setReceipts([]);
      return;
    }
    void reloadLedger().catch((error) => {
      console.error("Failed to load transactions", error);
    });
  }, [isReady, profile, ledgerStamp, reloadLedger]);

  const attachReceipts = useCallback(
    async (entry: Transaction, sourceUris: string[]) => {
      if (!profile || sourceUris.length === 0) return;
      const ownerName = ownerLabel(entry.memberId, members);
      for (const sourceUri of sourceUris) {
        const stored = sourceUri.startsWith(receiptsDir())
          ? {
              id: sourceUri.split("/").pop()?.replace(/\.jpg$/i, "") ?? "",
              uri: sourceUri,
              fileName: sourceUri.split("/").pop() ?? "",
            }
          : await persistReceiptFromPicker(sourceUri);
        if (!stored.id || !stored.fileName) continue;
        await insertReceipt(profile.id, {
          id: stored.id,
          entryId: entry.id,
          date: entry.date,
          name: entry.name,
          category: entry.category,
          amount: entry.amount,
          ownerName: ownerName === "Wspólny" ? null : ownerName,
          createdAt: new Date().toISOString(),
          uri: stored.uri,
          fileName: stored.fileName,
        });
      }
    },
    [members, profile]
  );

  const addEntry = useCallback(
    async (input: NewTransaction, options?: { receiptUris?: string[] }) => {
      if (!profile) return;
      const created = await insertTransaction(profile.id, input);
      setEntries((current) => [created, ...current]);
      if (options?.receiptUris?.length) {
        await attachReceipts(created, options.receiptUris);
        const nextReceipts = await listReceipts(profile.id);
        setReceipts(nextReceipts);
      }
      try {
        await pushBudget();
      } catch {
        // sqlite already has the entry
      }
    },
    [attachReceipts, profile, pushBudget]
  );

  const updateEntry = useCallback(
    async (id: number, input: NewTransaction) => {
      if (!profile) return;
      const updated = await updateTransaction(id, input);
      setEntries((current) => current.map((entry) => (entry.id === id ? updated : entry)));
      if (updated.type === "expense") {
        const owner = ownerLabel(updated.memberId, members);
        await updateReceiptsForEntry(id, {
          date: updated.date,
          name: updated.name,
          category: updated.category,
          amount: updated.amount,
          ownerName: owner === "Wspólny" ? null : owner,
        });
        setReceipts(await listReceipts(profile.id));
      }
      try {
        await pushBudget();
      } catch {
        // sqlite already has the change
      }
    },
    [members, profile, pushBudget]
  );

  const removeEntry = useCallback(
    async (id: number) => {
      await removeReceiptsForEntry(id);
      await deleteTransaction(id);
      setEntries((current) => current.filter((entry) => entry.id !== id));
      setReceipts((current) => current.filter((item) => item.entryId !== id));
      try {
        await pushBudget();
      } catch {
        // sqlite already dropped the entry
      }
    },
    [pushBudget]
  );

  const addReceiptsToEntry = useCallback(
    async (entry: Transaction, sourceUris: string[]) => {
      if (!profile) return;
      await attachReceipts(entry, sourceUris);
      const nextReceipts = await listReceipts(profile.id);
      setReceipts(nextReceipts);
      try {
        await pushBudget();
      } catch {
        // local receipt stays
      }
    },
    [attachReceipts, profile, pushBudget]
  );

  const addStandaloneReceipts = useCallback(
    async (input: Pick<NewReceipt, "date" | "name" | "category" | "amount" | "ownerName">, sourceUris: string[]) => {
      if (!profile) return;
      for (const sourceUri of sourceUris) {
        const stored = await persistReceiptFromPicker(sourceUri);
        await insertReceipt(profile.id, {
          ...input,
          id: stored.id,
          entryId: null,
          standalone: true,
          createdAt: new Date().toISOString(),
          uri: stored.uri,
          fileName: stored.fileName,
        });
      }
      setReceipts(await listReceipts(profile.id));
      try {
        await pushBudget();
      } catch {
        // Saved locally; synchronization retries later.
      }
    },
    [profile, pushBudget]
  );

  const removeReceipt = useCallback(
    async (id: string) => {
      await deleteReceiptRow(id);
      setReceipts((current) => current.filter((item) => item.id !== id));
      try {
        await pushBudget();
      } catch {
        // sqlite already dropped the receipt
      }
    },
    [pushBudget]
  );

  const value = useMemo(
    () => ({ entries, receipts, addEntry, updateEntry, removeEntry, addReceiptsToEntry, addStandaloneReceipts, removeReceipt }),
    [entries, receipts, addEntry, updateEntry, removeEntry, addReceiptsToEntry, addStandaloneReceipts, removeReceipt]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
};

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error("useFinance must be used within FinanceProvider");
  }
  return context;
}
