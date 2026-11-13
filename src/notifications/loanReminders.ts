import { AppState, Platform } from "react-native";
import { useEffect } from "react";
import { Transaction } from "../db/interfaces";
import { recurringDate, recurringExpenseKey, recurringExpensePaid } from "../helpers/spendingPlan";
import { Loan } from "../db/loanTypes";
import { parsePickedDate } from "../helpers/dates";
import { loanSchedule } from "../helpers/loans";

const TYPE = "loan-reminder";
const CHANNEL = "loan-reminders";
let permissionRequested = false;
let queue: Promise<void> = Promise.resolve();

export function loanReminderPlan(loans: Loan[], now: Date) {
  return loans.flatMap((loan) => loanSchedule(loan).flatMap((row) => {
    if (row.payment || row.skipped) return [];
    return [7, 3, 1].flatMap((days) => {
      const date = parsePickedDate(row.date);
      date.setDate(date.getDate() - days);
      date.setHours(9, 0, 0, 0);
      return date > now ? [{
        key: `${TYPE}:${loan.id}:${row.number}:${days}:${date.getTime()}`,
        date, days, name: loan.name, number: row.number,
      }] : [];
    });
  })).sort((a, b) => a.date.getTime() - b.date.getTime() || a.key.localeCompare(b.key));
}

const EXPENSE_TYPE = "recurring-expense-reminder";

export function recurringExpenseReminderPlan(entries: Transaction[], now: Date) {
  return entries.filter(entry => entry.regular && entry.type === "expense").flatMap(entry =>
    Array.from({ length: 12 }, (_, offset) => {
      const month = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      if (recurringExpensePaid(entry, month, entries)) return [];
      return [7, 3, 1].flatMap(days => {
        const date = recurringDate(entry, month);
        date.setDate(date.getDate() - days);
        date.setHours(9, 0, 0, 0);
        return date > now ? [{
          key: `${EXPENSE_TYPE}:${recurringExpenseKey(entry, month)}:${days}:${date.getTime()}`,
          date, days, name: entry.name || entry.category, number: null,
        }] : [];
      });
    }).flat()
  );
}

async function reconcile(loans: Loan[], entries: Transaction[]) {
  const notifications = await import("expo-notifications");
  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  const ours = scheduled.filter((item) => item.content.data?.type === TYPE || item.content.data?.type === EXPENSE_TYPE);
  if ((loans.length || entries.some(entry => entry.regular && entry.type === "expense")) && Platform.OS === "android") {
    await notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Terminy płatności", importance: notifications.AndroidImportance.DEFAULT,
    });
  }
  const now = new Date();
  const plan = [...loanReminderPlan(loans, now), ...recurringExpenseReminderPlan(entries, now)]
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.key.localeCompare(b.key));
  // iOS caps pending notifications per app. Leave room for other app notifications.
  const desired = plan.slice(0, Math.max(0, 60 - (scheduled.length - ours.length)));
  const desiredByKey = new Map(desired.map((item) => [item.key, item]));
  const existing = new Set<string>();
  for (const item of ours) {
    const reminder = desiredByKey.get(item.identifier);
    if (reminder && item.content.data?.loanName === reminder.name) existing.add(item.identifier);
    else await notifications.cancelScheduledNotificationAsync(item.identifier);
  }
  if (desired.some((item) => !existing.has(item.key))) {
    let permission = await notifications.getPermissionsAsync();
    const hasPermission = () => permission.granted || permission.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;
    if (!hasPermission() && permission.canAskAgain && !permissionRequested && AppState.currentState === "active") {
      permissionRequested = true;
      permission = await notifications.requestPermissionsAsync();
    }
    if (!hasPermission()) return;
  }
  for (const item of desired) {
    if (existing.has(item.key)) continue;
    await notifications.scheduleNotificationAsync({
      identifier: item.key,
      content: {
        title: item.number === null ? "Czy stały wydatek został zapłacony?" : "Przypomnienie o spłacie raty",
        body: `${item.name} · ${item.number === null ? "termin" : `rata ${item.number}`} ${item.days === 1 ? "jutro" : `za ${item.days} dni`}.`,
        data: { type: item.number === null ? EXPENSE_TYPE : TYPE, loanName: item.name },
      },
      trigger: { type: notifications.SchedulableTriggerInputTypes.DATE, date: item.date, channelId: CHANNEL },
    });
  }
}

export function usePaymentReminders(loans: Loan[] | undefined, entries: Transaction[]) {
  useEffect(() => {
    if (Platform.OS === "web" || loans === undefined) return;
    let current = true;
    const refresh = () => {
      queue = queue.then(async () => {
        if (current) await reconcile(loans, entries);
      }).catch((error) => console.warn("Nie udało się odświeżyć przypomnień o płatnościach", error));
    };
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      current = false;
      subscription.remove();
    };
  }, [loans, entries]);
}
