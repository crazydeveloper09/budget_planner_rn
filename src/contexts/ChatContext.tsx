import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { useFinance } from "./FinanceContext";
import { useProfile } from "./ProfileContext";
import {
  ensureDefaultTopics,
  insertChatMessage,
  insertChatTopic,
  listChatMessages,
  listChatTopics,
} from "../db/chat";
import { ChatMessage, ChatPlan, ChatTopic } from "../db/interfaces";
import { notifyChatMessage } from "../notifications/chatPush";

type ChatContextValue = {
  topics: ChatTopic[];
  messages: ChatMessage[];
  sendMessage: (topicId: string, body: string) => Promise<void>;
  sendPlan: (topicId: string, plan: ChatPlan) => Promise<void>;
  addTopic: (title: string) => Promise<ChatTopic | undefined>;
};

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, ledgerStamp } = useProfile();
  const { user, pushBudget } = useAuth();
  const { addEntry } = useFinance();
  const [topics, setTopics] = useState<ChatTopic[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const authorName =
    user?.familyMemberName || user?.displayName || profile?.name || "Ktoś z domu";

  const reload = useCallback(async () => {
    if (!profile) {
      setTopics([]);
      setMessages([]);
      return;
    }
    const nextTopics = await ensureDefaultTopics(profile.id, profile.accountType);
    const nextMessages = await listChatMessages(profile.id);
    setTopics(nextTopics);
    setMessages(nextMessages);
  }, [profile]);

  useEffect(() => {
    void reload();
  }, [reload, ledgerStamp]);

  const sendMessage = useCallback(
    async (topicId: string, body: string) => {
      if (!profile) return;
      const trimmed = body.trim();
      if (!trimmed) return;
      const created = await insertChatMessage({
        userId: profile.id,
        topicId,
        authorName,
        body: trimmed,
        plan: null,
      });
      setMessages((current) => [...current, created]);
      try {
        await pushBudget();
      } catch {
        // local message stays
      }
      const topic = topics.find((item) => item.id === topicId);
      try {
        await notifyChatMessage({
          topicId,
          topicTitle: topic?.title ?? "Czat",
          authorName,
          kind: "message",
        });
      } catch {
        // powiadomienie dojdzie przy następnym syncu, wiadomość już jest
      }
    },
    [authorName, profile, pushBudget, topics]
  );

  const sendPlan = useCallback(
    async (topicId: string, plan: ChatPlan) => {
      if (!profile) return;
      const created = await insertChatMessage({
        userId: profile.id,
        topicId,
        authorName,
        body: plan.name || plan.category,
        plan,
      });
      setMessages((current) => [...current, created]);
      await addEntry({
        date: plan.date,
        type: plan.type,
        name: plan.name,
        category: plan.category,
        amount: plan.amount,
        regular: false,
        memberId: plan.memberId,
      });
      const topic = topics.find((item) => item.id === topicId);
      try {
        await notifyChatMessage({
          topicId,
          topicTitle: topic?.title ?? "Czat",
          authorName,
          kind: "plan",
        });
      } catch {
        // plan jest w budżecie nawet bez dzwonka
      }
    },
    [addEntry, authorName, profile, topics]
  );

  const addTopic = useCallback(
    async (title: string) => {
      if (!profile) return;
      const trimmed = title.trim();
      if (trimmed.length < 2) return;
      const created = await insertChatTopic(profile.id, trimmed);
      setTopics((current) => [...current, created]);
      try {
        await pushBudget();
      } catch {
        // local topic stays
      }
      return created;
    },
    [profile, pushBudget]
  );

  const value = useMemo(
    () => ({ topics, messages, sendMessage, sendPlan, addTopic }),
    [topics, messages, sendMessage, sendPlan, addTopic]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return context;
}
