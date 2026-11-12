import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { NewReceipt, NewTransaction, Receipt, Transaction } from "../db/interfaces";
import {
  insertReceipt,
  listReceipts,
  removeReceipt as deleteReceiptRow,
  removeReceiptsForEntry,
  ReceiptDetails,
  updateReceiptDetails,
  updateReceiptsForEntry,
} from "../db/receipts";
import {
  addTransaction as insertTransaction,
  removeTransaction as deleteTransaction,
  updateTransaction,
} from "../db/transactions";
import { persistReceiptFromPicker, receiptsDir } from "../helpers/receiptFiles";
import { ownerLabel } from "../helpers/owners";
import { useAuth } from "./AuthContext";
import { useProfile } from "./ProfileContext";
import { Loan } from "../db/loanTypes";
import { addLoan, applyLoanAction, LoanAction, readLoanLedger } from "../db/loans";
import { useLoanReminders } from "../notifications/loanReminders";

type FinanceContextValue = {
  entries: Transaction[];
  receipts: Receipt[];
  loans: Loan[];
  createLoan: (loan: Loan) => Promise<void>;
  changeLoan: (id: string, action: LoanAction) => Promise<void>;
  addEntry: (input: NewTransaction, options?: { receiptUris?: string[] }) => Promise<void>;
  updateEntry: (id: number, input: NewTransaction) => Promise<void>;
  removeEntry: (id: number) => Promise<void>;
  addReceiptsToEntry: (entry: Transaction, sourceUris: string[]) => Promise<void>;
  addStandaloneReceipts: (input: Pick<NewReceipt, "date" | "name" | "category" | "amount" | "ownerName">, sourceUris: string[]) => Promise<void>;
  removeReceipt: (id: string) => Promise<void>;
  updateReceipt: (id: string, input: ReceiptDetails) => Promise<void>;
};

const FinanceContext = createContext<FinanceContextValue | undefined>(undefined);
const noLoans: Loan[] = [];

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, members, isReady, ledgerStamp, refreshProfile } = useProfile();
  const { pushBudget } = useAuth();
  const [entries, setEntries] = useState<Transaction[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loadedLoanProfile, setLoadedLoanProfile] = useState<number | null>(null);
  useLoanReminders(isReady ? (!profile ? noLoans : profile.id === loadedLoanProfile ? loans : undefined) : undefined);

  const reloadLedger = useCallback(async () => {
    if (!profile) {
      setEntries([]);
      setReceipts([]);
      setLoans([]);
      setLoadedLoanProfile(null);
      return;
    }
    const [ledger, nextReceipts] = await Promise.all([
      readLoanLedger(profile.id),
      listReceipts(profile.id),
    ]);
    setEntries(ledger.entries);
    setLoans(ledger.loans);
    setLoadedLoanProfile(profile.id);
    setReceipts(nextReceipts);
  }, [profile]);

  useEffect(() => {
    if (!isReady || !profile) {
      setEntries([]);
      setReceipts([]);
      setLoans([]);
      setLoadedLoanProfile(null);
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
      const updated = await updateTransaction(id, input, profile.id);
      await refreshProfile();
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
    [members, profile, pushBudget, refreshProfile]
  );

  const removeEntry = useCallback(
    async (id: number) => {
      if (!profile) return;
      await removeReceiptsForEntry(id);
      await deleteTransaction(id, profile.id);
      await refreshProfile();
      setEntries((current) => current.filter((entry) => entry.id !== id));
      setReceipts((current) => current.filter((item) => item.entryId !== id));
      try {
        await pushBudget();
      } catch {
        // sqlite already dropped the entry
      }
    },
    [profile, pushBudget, refreshProfile]
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

  const updateReceipt = useCallback(async (id: string, input: ReceiptDetails) => {
    if (!profile) throw new Error("No active profile");
    await updateReceiptDetails(profile.id, id, input);
    setReceipts(await listReceipts(profile.id));
    try {
      await pushBudget();
    } catch {
      // Synchronization retries the local change.
    }
  }, [profile, pushBudget]);

  const createLoan = useCallback(async (loan: Loan) => {
    if (!profile) throw new Error("Brak aktywnego profilu.");
    await addLoan(profile.id, loan);
    await reloadLedger();
    await pushBudget().catch(console.error);
  }, [profile, reloadLedger, pushBudget]);

  const changeLoan = useCallback(async (id: string, action: LoanAction) => {
    if (!profile) throw new Error("Brak aktywnego profilu.");
    await applyLoanAction(profile.id, id, action);
    await refreshProfile();
    await reloadLedger();
    await pushBudget().catch(console.error);
  }, [profile, refreshProfile, reloadLedger, pushBudget]);

  const value = useMemo(
    () => ({ entries, receipts, loans, createLoan, changeLoan, addEntry, updateEntry, removeEntry, addReceiptsToEntry, addStandaloneReceipts, removeReceipt, updateReceipt }),
    [entries, receipts, loans, createLoan, changeLoan, addEntry, updateEntry, removeEntry, addReceiptsToEntry, addStandaloneReceipts, removeReceipt, updateReceipt]
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
