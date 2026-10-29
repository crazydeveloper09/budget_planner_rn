import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { api } from "../api/client";
import { openChatTopic } from "../navigators/navigationRef";

const PUSH_TOKEN_KEY = "bp_push_token";

let activeTopicId: string | null = null;

export function setActiveChatTopic(topicId: string | null) {
  activeTopicId = topicId;
}

export function getActiveChatTopic() {
  return activeTopicId;
}

export function configureChatNotificationHandler() {
  try {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as { topicId?: string };
      const suppress = Boolean(data?.topicId && data.topicId === activeTopicId);
      return {
        shouldShowAlert: !suppress,
        shouldShowBanner: !suppress,
        shouldShowList: !suppress,
        shouldPlaySound: !suppress,
        shouldSetBadge: false,
      };
    },
  });
  } catch {
    // Expo Go 57 Android: brak ExpoTopicSubscriptionModule
  }
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("chat", {
    name: "Czat",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#702963",
  });
}

export async function registerChatPushToken() {
  if (Platform.OS === "web") return;
  try {
  await ensureAndroidChannel();
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return;
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
  await api.put("/me/push-token", { token });
  } catch {
    // Expo Go / brak natywnego pusha
  }
}

export async function unregisterChatPushToken() {
  const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  if (token) {
    try {
      await api.delete("/me/push-token", { params: { token } });
    } catch {
      // logout still continues
    }
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  }
}

export async function notifyChatMessage(input: {
  topicId: string;
  topicTitle: string;
  authorName: string;
  kind?: "message" | "plan";
}) {
  await api.post("/households/chat-notify", input);
}

export function handleChatNotificationResponse(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data as {
    type?: string;
    topicId?: string;
    title?: string;
  };
  if (data?.type !== "chat" || !data.topicId) return;
  openChatTopic(data.topicId, data.title || "Czat");
}
