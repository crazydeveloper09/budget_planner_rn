import { Platform } from "react-native";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { api } from "../api/client";
import { withTimeout } from "../helpers/withTimeout";
import { openChatTopic } from "../navigators/navigationRef";

const PUSH_TOKEN_KEY = "bp_push_token";

let activeTopicId: string | null = null;

export function setActiveChatTopic(topicId: string | null) {
  activeTopicId = topicId;
}

export function getActiveChatTopic() {
  return activeTopicId;
}

export async function configureChatNotificationHandler() {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await import("expo-notifications");
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
    // Expo Go / brak natywnego modułu
  }
}

export async function registerChatPushToken() {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await import("expo-notifications");
    if (Platform.OS === "android") {
      await withTimeout(
        Notifications.setNotificationChannelAsync("chat", {
          name: "Czat",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#702963",
        }),
        4000
      );
    }
    const permission = await withTimeout(Notifications.requestPermissionsAsync(), 4000);
    if (permission.status !== "granted") return;
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    const token = (
      await withTimeout(Notifications.getExpoPushTokenAsync({ projectId }), 6000)
    ).data;
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
    await api.put("/me/push-token", { token });
  } catch {
    // Huawei / Motorola / brak GMS / FCM
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

export async function listenForChatNotificationResponse() {
  if (Platform.OS === "web") return () => undefined;
  try {
    const Notifications = await import("expo-notifications");
    const received = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        type?: string;
        topicId?: string;
        title?: string;
      };
      if (data?.type !== "chat" || !data.topicId) return;
      openChatTopic(data.topicId, data.title || "Czat");
    });
    return () => {
      try {
        received.remove();
      } catch {
        // native listener już nie żyje
      }
    };
  } catch {
    return () => undefined;
  }
}
