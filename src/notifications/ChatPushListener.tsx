import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { useAuth } from "../contexts/AuthContext";
import {
  handleChatNotificationResponse,
  registerChatPushToken,
} from "./chatPush";

export default function ChatPushListener() {
  const { user, household } = useAuth();

  useEffect(() => {
    if (!user || !household) return;
    void registerChatPushToken().catch(() => {
      // simulator / brak zgody
    });
  }, [user, household]);

  useEffect(() => {
    const received = Notifications.addNotificationResponseReceivedListener((response) => {
      handleChatNotificationResponse(response);
    });
    return () => {
      received.remove();
    };
  }, []);

  return null;
}
