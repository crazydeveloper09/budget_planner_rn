import { recurringExpenseKey, recurringExpensePaid, recurringPostingKey } from "../helpers/spendingPlan";
import { toIsoDate } from "../helpers/dates";
import { withDatabaseTransaction } from "./init";
import { addTransaction, listTransactions } from "./transactions";

export async function confirmRecurringExpense(userId: number, id: number, month: Date): Promise<void> {
  await withDatabaseTransaction(async (database) => {
    const entries = await listTransactions(userId, database);
    const template = entries.find(item => item.id === id && item.regular && item.type === "expense");
    if (!template) throw new Error("Nie znaleziono stałego wydatku.");
    if (recurringExpensePaid(template, month, entries)) return;
    if (!template.recurringKey) {
      template.recurringKey = recurringPostingKey(template);
      await database.runAsync("UPDATE entries SET recurring_key = ? WHERE id = ? AND user_id = ?", [template.recurringKey, id, userId]);
    }
    await addTransaction(userId, {
      ...template,
      regular: false,
      date: toIsoDate(new Date()),
      recurringKey: recurringExpenseKey(template, month),
    }, database);
  });
}
