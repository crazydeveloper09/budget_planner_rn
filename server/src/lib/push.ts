type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: "default";
  channelId?: string;
};

type ExpoTicket = {
  status?: string;
  message?: string;
  details?: { error?: string };
};

export async function sendExpoPush(messages: ExpoPushMessage[]) {
  if (messages.length === 0) return [];
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });
  const payload = (await response.json()) as { data?: ExpoTicket[] };
  return payload.data ?? [];
}

export function isExpoPushToken(token: string) {
  return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
}
