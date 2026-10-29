import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef();

export function openChatTopic(topicId: string, title: string) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate(
    "Main" as never,
    {
      screen: "Chat",
      params: {
        screen: "ChatThread",
        params: { topicId, title },
      },
    } as never
  );
}
