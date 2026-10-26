import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { NewTransaction, Transaction } from "../db/interfaces";
import { addTransaction as insertTransaction, listTransactions, removeTransaction as deleteTransaction } from "../db/transactions";
import { useAuth } from "./AuthContext";
import { useProfile } from "./ProfileContext";

type FinanceContextValue = {
  entries: Transaction[];
  addEntry: (input: NewTransaction) => Promise<void>;
  removeEntry: (id: number) => Promise<void>;
};

const FinanceContext = createContext<FinanceContextValue | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, isReady, ledgerStamp } = useProfile();
  const { pushBudget } = useAuth();
  const [entries, setEntries] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!isReady || !profile) {
      setEntries([]);
      return;
    }

    let isMounted = true;
    listTransactions(profile.id)
      .then((items) => {
        if (isMounted) setEntries(items);
      })
      .catch((error) => {
        console.error("Failed to load transactions", error);
      });

    return () => {
      isMounted = false;
    };
  }, [isReady, profile, ledgerStamp]);

  const addEntry = useCallback(async (input: NewTransaction) => {
    if (!profile) return;
    const created = await insertTransaction(profile.id, input);
    setEntries((current) => [created, ...current]);
    try {
      await pushBudget();
    } catch {
      // sqlite already has the entry
    }
  }, [profile, pushBudget]);

  const removeEntry = useCallback(async (id: number) => {
    await deleteTransaction(id);
    setEntries((current) => current.filter((entry) => entry.id !== id));
    try {
      await pushBudget();
    } catch {
      // sqlite already dropped the entry
    }
  }, [pushBudget]);

  const value = useMemo(
    () => ({ entries, addEntry, removeEntry }),
    [entries, addEntry, removeEntry]
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
