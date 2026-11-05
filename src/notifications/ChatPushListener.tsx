import { useEffect } from "react";
import { AppState } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useProfile } from "../contexts/ProfileContext";
import {
  configureChatNotificationHandler,
  listenForChatNotificationResponse,
  registerChatPushToken,
} from "./chatPush";

export default function ChatPushListener() {
  const { isReady: authReady, user, household } = useAuth();
  const { isReady } = useProfile();
  const appReady = authReady && isReady;

  useEffect(() => {
    void configureChatNotificationHandler();
  }, []);

  useEffect(() => {
    if (!appReady || !user?.id || !household?.id) return;
    let cancelled = false;
    let registering = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const register = async () => {
      if (cancelled || registering) return;
      registering = true;
      clearTimeout(retry);
      try {
        await registerChatPushToken();
      } catch {
        if (!cancelled) retry = setTimeout(() => void register(), 30000);
      } finally {
        registering = false;
      }
    };
    void register();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void register();
    });
    return () => {
      cancelled = true;
      clearTimeout(retry);
      sub.remove();
    };
  }, [appReady, user?.id, household?.id]);

  useEffect(() => {
    if (!appReady) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void listenForChatNotificationResponse().then((stop) => {
      if (cancelled) stop();
      else unsubscribe = stop;
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [appReady]);

  return null;
}
