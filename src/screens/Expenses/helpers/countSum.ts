import { Transaction } from "../../../db/interfaces";

export const totalExpenses = (items: Transaction[]) =>
  items.reduce((acc, item) => acc + (item.type === "expense" ? item.amount : 0), 0);

export const totalIncomings = (items: Transaction[]) =>
  items.reduce((acc, item) => acc + (item.type === "income" ? item.amount : 0), 0);

export const howManySaved = (incomings: number, spendings: number, saldo: number) =>
  saldo - spendings + incomings;
