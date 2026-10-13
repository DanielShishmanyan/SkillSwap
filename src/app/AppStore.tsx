import { useState, type ReactNode } from "react";
import {
  demoConversations,
  demoLessons,
  demoSwaps,
  demoUsers,
} from "../data/demo";
import { useAuth } from "../features/auth/AuthProvider";
import { achievementsFor } from "../features/gamification/gamification.service";
import { createSwapSessions } from "../features/swaps/swaps.utils";
import type {
  Conversation,
  LearningSkill,
  Lesson,
  Message,
  Swap,
  TeachableSkill,
  UserProfile,
} from "../types/domain";
import { AppStoreContext, type AppStoreValue } from "./app-store.context";

const PROFILES_KEY = "skillswap.profiles";
const CONVERSATIONS_KEY = "skillswap.conversations";
const readProfiles = (): UserProfile[] => {
  try {
    return JSON.parse(
      localStorage.getItem(PROFILES_KEY) ?? "[]",
    ) as UserProfile[];
  } catch {
    return [];
  }
};
const readConversations = (): Conversation[] => {
  try {
    return JSON.parse(localStorage.getItem(CONVERSATIONS_KEY) ?? "[]") as Conversation[];
  } catch {
    return [];
  }
};
const createBlankProfile = (identity: {
  id: string;
  name: string;
  email: string;
}): UserProfile => ({
  id: identity.id,
  name: identity.name,
  email: identity.email,
  avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(identity.name)}&background=287a55&color=ffffff&size=256&bold=true`,
  bio: "",
  location: "",
  availability: { days: [], time: "", timezone: "Europe/Sofia" },
  ratingAverage: 0,
  ratingCount: 0,
  completedSwaps: 0,
  completedLessons: 0,
  xp: 0,
  level: 1,
  teaches: [],
  learns: [],
  achievements: achievementsFor(0, 0, 0),
  availableNow: false,
});

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const { user: authenticatedUser } = useAuth();
  const [users, setUsers] = useState(() => {
    const profiles = readProfiles().filter(
      (profile) => !demoUsers.some((demo) => demo.id === profile.id),
    );
    return [...demoUsers, ...profiles];
  });
  const [swaps, setSwaps] = useState(demoSwaps);
  const [lessons, setLessons] = useState(demoLessons);
  const [allConversations, setAllConversations] = useState(() => [
    ...demoConversations,
    ...readConversations().filter(
      (stored) => !demoConversations.some((demo) => demo.id === stored.id),
    ),
  ]);
  const currentUser = authenticatedUser
    ? (users.find((profile) => profile.id === authenticatedUser.id) ??
      createBlankProfile(authenticatedUser))
    : createBlankProfile({
        id: "signed-out",
        name: "SkillSwap member",
        email: "",
      });
  const conversations = allConversations.filter((conversation) =>
    conversation.participantIds.includes(currentUser.id),
  );
  const persistConversations = (items: Conversation[]) =>
    localStorage.setItem(
      CONVERSATIONS_KEY,
      JSON.stringify(
        items.filter(
          (item) => !demoConversations.some((demo) => demo.id === item.id),
        ),
      ),
    );
  const updateProfile = (update: Partial<UserProfile>) =>
    setUsers((all) => {
      const exists = all.some((profile) => profile.id === currentUser.id);
      const next = exists
        ? all.map((profile) =>
            profile.id === currentUser.id ? { ...profile, ...update } : profile,
          )
        : [...all, { ...currentUser, ...update }];
      localStorage.setItem(
        PROFILES_KEY,
        JSON.stringify(
          next.filter(
            (profile) => !demoUsers.some((demo) => demo.id === profile.id),
          ),
        ),
      );
      return next;
    });
  const updateSkills = (teaches: TeachableSkill[], learns: LearningSkill[]) =>
    updateProfile({ teaches, learns });
  const createSwap = (input: Parameters<AppStoreValue["createSwap"]>[0]) =>
    setSwaps((all) => {
      const now = new Date().toISOString();
      const swap: Swap = {
        ...input,
        id: crypto.randomUUID(),
        requesterId: currentUser.id,
        status: "pending",
        lastProposedBy: currentUser.id,
        proposalVersion: 1,
        createdAt: now,
        updatedAt: now,
        sessions: [],
        activity: [
          {
            id: crypto.randomUUID(),
            actorId: currentUser.id,
            type: "proposed",
            message: `${currentUser.name} proposed ${input.requesterOffer.skillName} ↔ ${input.receiverOffer.skillName}.`,
            createdAt: now,
          },
        ],
      };
      return [swap, ...all];
    });
  const counterSwap = (
    id: string,
    update: Parameters<AppStoreValue["counterSwap"]>[1],
  ) =>
    setSwaps((all) =>
      all.map((swap) =>
        swap.id === id
          ? {
              ...swap,
              ...update,
              status: "pending",
              lastProposedBy: currentUser.id,
              proposalVersion: swap.proposalVersion + 1,
              updatedAt: new Date().toISOString(),
              activity: [
                ...swap.activity,
                {
                  id: crypto.randomUUID(),
                  actorId: currentUser.id,
                  type: "countered",
                  message: `${currentUser.name} sent a counter offer.`,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : swap,
      ),
    );
  const acceptSwap = (id: string) =>
    setSwaps((all) =>
      all.map((swap) => {
        if (swap.id !== id) return swap;
        const accepted = {
          ...swap,
          status: "active" as const,
          acceptedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return {
          ...accepted,
          sessions: createSwapSessions(accepted),
          activity: [
            ...swap.activity,
            {
              id: crypto.randomUUID(),
              actorId: currentUser.id,
              type: "accepted" as const,
              message: `${currentUser.name} accepted the swap.`,
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }),
    );
  const updateSwap = (id: string, status: Swap["status"]) =>
    setSwaps((all) => all.map((s) => (s.id === id ? { ...s, status } : s)));
  const scheduleSession = (
    swapId: string,
    sessionId: string,
    update: Parameters<AppStoreValue["scheduleSession"]>[2],
  ) =>
    setSwaps((all) =>
      all.map((swap) =>
        swap.id === swapId
          ? {
              ...swap,
              sessions: swap.sessions.map((session) =>
                session.id === sessionId
                  ? { ...session, ...update, status: "scheduled" }
                  : session,
              ),
              activity: [
                ...swap.activity,
                {
                  id: crypto.randomUUID(),
                  actorId: currentUser.id,
                  type: "scheduled",
                  message: `${currentUser.name} scheduled a session.`,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : swap,
      ),
    );
  const completeSession = (swapId: string, sessionId: string) => {
    const target = swaps.find((swap) => swap.id === swapId);
    const session = target?.sessions.find((item) => item.id === sessionId);
    if (!target || !session || session.status === "completed") return;
    const completesSwap =
      target.status !== "completed" &&
      target.sessions.every(
        (item) => item.id === sessionId || item.status === "completed",
      );
    setSwaps((all) =>
      all.map((swap) => {
        if (swap.id !== swapId) return swap;
        const sessions = swap.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                status: "completed" as const,
                completedAt: new Date().toISOString(),
              }
            : session,
        );
        const completed =
          sessions.length > 0 &&
          sessions.every((session) => session.status === "completed");
        return {
          ...swap,
          sessions,
          status: completed ? "completed" : swap.status,
          completedAt: completed ? new Date().toISOString() : swap.completedAt,
          activity: [
            ...swap.activity,
            {
              id: crypto.randomUUID(),
              actorId: currentUser.id,
              type: completed ? "completed" : "session_completed",
              message: completed
                ? "All sessions completed."
                : `${currentUser.name} completed a session.`,
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }),
    );
    if (completesSwap) {
      const completedSwaps = currentUser.completedSwaps + 1;
      const xp = currentUser.xp + 100;
      updateProfile({
        completedSwaps,
        xp,
        level: Math.max(currentUser.level, Math.floor(xp / 500) + 1),
        achievements: achievementsFor(
          completedSwaps,
          currentUser.completedLessons,
          currentUser.ratingAverage,
        ),
      });
    }
  };
  const createLesson = (lesson: Omit<Lesson, "id">) =>
    setLessons((all) => [{ ...lesson, id: crypto.randomUUID() }, ...all]);
  const openConversation = (participantId: string, context = "Direct message") => {
    if (participantId === currentUser.id)
      throw new Error("You cannot message yourself.");
    const existing = allConversations.find(
      (conversation) =>
        conversation.participantIds.length === 2 &&
        conversation.participantIds.includes(currentUser.id) &&
        conversation.participantIds.includes(participantId),
    );
    if (existing) return existing.id;
    const conversation: Conversation = {
      id: crypto.randomUUID(),
      participantIds: [currentUser.id, participantId],
      context,
      messages: [],
    };
    setAllConversations((all) => {
      const next = [conversation, ...all];
      persistConversations(next);
      return next;
    });
    return conversation.id;
  };
  const sendMessage = (conversationId: string, text: string) => {
    const conversation = allConversations.find(
      (item) => item.id === conversationId,
    );
    if (!conversation?.participantIds.includes(currentUser.id)) return;
    const message: Message = {
      id: crypto.randomUUID(),
      senderId: currentUser.id,
      text,
      createdAt: new Date().toISOString(),
      read: true,
    };
    setAllConversations((all) => {
      const next = all.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, message] }
          : c,
      );
      persistConversations(next);
      return next;
    });
  };
  const value = {
    currentUser,
    users,
    swaps,
    lessons,
    conversations,
    updateProfile,
    updateSkills,
    createSwap,
    counterSwap,
    acceptSwap,
    updateSwap,
    scheduleSession,
    completeSession,
    createLesson,
    openConversation,
    sendMessage,
  };
  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}
