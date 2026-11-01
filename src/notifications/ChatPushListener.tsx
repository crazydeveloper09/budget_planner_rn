import { useEffect } from "react";
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
    if (!appReady) return;
    const timer = setTimeout(() => {
      void configureChatNotificationHandler();
    }, 2000);
    return () => clearTimeout(timer);
  }, [appReady]);

  useEffect(() => {
    if (!appReady || !user || !household) return;
    const timer = setTimeout(() => {
      void registerChatPushToken();
    }, 4000);
    return () => clearTimeout(timer);
  }, [appReady, user, household]);

  useEffect(() => {
    if (!appReady) return;
    let unsubscribe: (() => void) | undefined;
    const timer = setTimeout(() => {
      void listenForChatNotificationResponse().then((stop) => {
        unsubscribe = stop;
      });
    }, 2000);
    return () => {
      clearTimeout(timer);
      unsubscribe?.();
    };
  }, [appReady]);

  return null;
}
