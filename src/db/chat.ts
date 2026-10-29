import { getRandomBytes } from "expo-crypto";
import { AccountType, ChatMessage, ChatPlan, ChatTopic } from "./interfaces";
import { getDb } from "./init";
import { bytesToHex } from "../crypto/bytes";

type TopicRow = {
  id: string;
  user_id: number;
  title: string;
  created_at: string;
};

type MessageRow = {
  id: string;
  user_id: number;
  topic_id: string;
  author_name: string;
  body: string;
  created_at: string;
  plan_json: string | null;
};

export function newChatId(prefix = "c"): string {
  return `${prefix}_${bytesToHex(getRandomBytes(8))}`;
}

function parsePlan(raw: string | null): ChatPlan | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ChatPlan;
    if (!parsed?.type || !parsed.category || typeof parsed.amount !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function mapTopic(row: TopicRow): ChatTopic {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    createdAt: row.created_at,
  };
}

function mapMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    userId: row.user_id,
    topicId: row.topic_id,
    authorName: row.author_name,
    body: row.body ?? "",
    createdAt: row.created_at,
    plan: parsePlan(row.plan_json),
  };
}

export function defaultChatTopics(accountType: AccountType): Array<{ id: string; title: string }> {
  if (accountType === "business") {
    return [
      { id: "topic-general", title: "Ogólny" },
      { id: "topic-costs", title: "Koszty" },
      { id: "topic-income", title: "Przychody" },
    ];
  }
  return [
    { id: "topic-general", title: "Ogólny" },
    { id: "topic-shopping", title: "Zakupy" },
    { id: "topic-bills", title: "Rachunki" },
  ];
}

export async function listChatTopics(userId: number): Promise<ChatTopic[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<TopicRow>(
    "SELECT id, user_id, title, created_at FROM chat_topics WHERE user_id = ? ORDER BY created_at ASC",
    [Number(userId)]
  );
  return rows.map(mapTopic);
}

export async function listChatMessages(userId: number, topicId?: string): Promise<ChatMessage[]> {
  const database = await getDb();
  const rows = topicId
    ? await database.getAllAsync<MessageRow>(
        `SELECT id, user_id, topic_id, author_name, body, created_at, plan_json
         FROM chat_messages WHERE user_id = ? AND topic_id = ? ORDER BY created_at ASC`,
        [Number(userId), topicId]
      )
    : await database.getAllAsync<MessageRow>(
        `SELECT id, user_id, topic_id, author_name, body, created_at, plan_json
         FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC`,
        [Number(userId)]
      );
  return rows.map(mapMessage);
}

export async function insertChatTopic(userId: number, title: string, id?: string): Promise<ChatTopic> {
  const database = await getDb();
  const topic: ChatTopic = {
    id: id ?? newChatId("t"),
    userId: Number(userId),
    title: title.trim(),
    createdAt: new Date().toISOString(),
  };
  await database.runAsync(
    "INSERT OR IGNORE INTO chat_topics (id, user_id, title, created_at) VALUES (?, ?, ?, ?)",
    [topic.id, topic.userId, topic.title, topic.createdAt]
  );
  return topic;
}

export async function insertChatMessage(input: Omit<ChatMessage, "id" | "createdAt"> & { id?: string }): Promise<ChatMessage> {
  const database = await getDb();
  const message: ChatMessage = {
    id: input.id ?? newChatId("m"),
    userId: Number(input.userId),
    topicId: input.topicId,
    authorName: input.authorName,
    body: input.body,
    createdAt: new Date().toISOString(),
    plan: input.plan,
  };
  await database.runAsync(
    `INSERT INTO chat_messages (id, user_id, topic_id, author_name, body, created_at, plan_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      message.id,
      message.userId,
      message.topicId,
      message.authorName,
      message.body,
      message.createdAt,
      message.plan ? JSON.stringify(message.plan) : null,
    ]
  );
  return message;
}

export async function replaceChat(
  userId: number,
  topics: Array<{ id: string; title: string; createdAt?: string }>,
  messages: Array<{
    id: string;
    topicId: string;
    authorName: string;
    body: string;
    createdAt: string;
    plan: ChatPlan | null;
  }>
): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM chat_messages WHERE user_id = ?", [Number(userId)]);
  await database.runAsync("DELETE FROM chat_topics WHERE user_id = ?", [Number(userId)]);
  for (const topic of topics) {
    await database.runAsync(
      "INSERT INTO chat_topics (id, user_id, title, created_at) VALUES (?, ?, ?, ?)",
      [topic.id, Number(userId), topic.title, topic.createdAt ?? new Date().toISOString()]
    );
  }
  for (const message of messages) {
    await database.runAsync(
      `INSERT INTO chat_messages (id, user_id, topic_id, author_name, body, created_at, plan_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        message.id,
        Number(userId),
        message.topicId,
        message.authorName,
        message.body,
        message.createdAt,
        message.plan ? JSON.stringify(message.plan) : null,
      ]
    );
  }
}

export async function ensureDefaultTopics(userId: number, accountType: AccountType): Promise<ChatTopic[]> {
  const existing = await listChatTopics(userId);
  if (existing.length > 0) return existing;
  for (const topic of defaultChatTopics(accountType)) {
    await insertChatTopic(userId, topic.title, topic.id);
  }
  return listChatTopics(userId);
}
