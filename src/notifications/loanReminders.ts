import { AppState, Platform } from "react-native";
import { useEffect } from "react";
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

async function reconcile(loans: Loan[]) {
  const notifications = await import("expo-notifications");
  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  const ours = scheduled.filter((item) => item.content.data?.type === TYPE);
  if (loans.length && Platform.OS === "android") {
    await notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Spłaty rat", importance: notifications.AndroidImportance.DEFAULT,
    });
  }
  const plan = loanReminderPlan(loans, new Date());
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
        title: "Przypomnienie o spłacie raty",
        body: `${item.name} · rata ${item.number} ${item.days === 1 ? "jutro" : `za ${item.days} dni`}.`,
        data: { type: TYPE, loanName: item.name },
      },
      trigger: { type: notifications.SchedulableTriggerInputTypes.DATE, date: item.date, channelId: CHANNEL },
    });
  }
}

export function useLoanReminders(loans: Loan[] | undefined) {
  useEffect(() => {
    if (Platform.OS === "web" || loans === undefined) return;
    let current = true;
    const refresh = () => {
      queue = queue.then(async () => {
        if (current) await reconcile(loans);
      }).catch((error) => console.warn("Nie udało się odświeżyć przypomnień o ratach", error));
    };
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      current = false;
      subscription.remove();
    };
  }, [loans]);
}
