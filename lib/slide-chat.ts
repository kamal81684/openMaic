export type SlideChatRole = "user" | "assistant";

export type SlideChatMessage = {
  role: SlideChatRole;
  content: string;
};

export type SlideChatResponse = {
  reply: string;
};

