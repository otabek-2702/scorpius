"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BottomNav } from "@/components/nav/BottomNav";
import { ensureAnonymousUser } from "@/lib/auth";
import { loadProfile, type StudentProfile } from "@/lib/profile";
import { PERSONAS, type PersonaId } from "@/lib/personas";
import { loadHumoChat, syncHumoMessage } from "@/lib/cloudSync";
import { MessageInput } from "./MessageInput";
import { MessageList, type ChatMessageView } from "./MessageList";
import { PersonaHeader } from "./PersonaHeader";
import { PersonaPicker } from "./PersonaPicker";

interface Props {
  /** Optional deep-link from /humo/[personaId]. Defaults to scorpius. */
  initialPersonaId?: PersonaId;
}

function storageKey(personaId: PersonaId): string {
  return `scorpius:humo:${personaId}`;
}

function loadHistory(personaId: PersonaId): ChatMessageView[] {
  try {
    const raw = localStorage.getItem(storageKey(personaId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessageView[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(personaId: PersonaId, messages: ChatMessageView[]): void {
  try {
    localStorage.setItem(
      storageKey(personaId),
      JSON.stringify(messages.map(({ role, content }) => ({ role, content }))),
    );
  } catch {
    /* localStorage unavailable */
  }
}

/** Strip the streaming flag from the visible list before sending to the API. */
function asApiMessages(messages: ChatMessageView[]) {
  return messages
    .filter((m) => m.content.trim().length > 0)
    .map(({ role, content }) => ({ role, content }));
}

export function HumoView({ initialPersonaId }: Props) {
  const [personaId, setPersonaId] = useState<PersonaId>(initialPersonaId ?? "scorpius");
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const persona = PERSONAS[personaId];

  // Bootstrap: anon UID + profile
  useEffect(() => {
    void ensureAnonymousUser().then(setUid);
    setProfile(loadProfile());
  }, []);

  // Load per-persona history when active persona changes.
  // localStorage first (instant), then cloud (catch-up if localStorage was empty).
  useEffect(() => {
    const history = loadHistory(personaId);
    if (history.length === 0) {
      // Show the persona's greeting as the first assistant bubble, but
      // DON'T persist it — it should regenerate fresh if the user resets.
      setMessages([{ role: "assistant", content: persona.greetingUz }]);
    } else {
      setMessages(history);
    }
    // Cancel any in-flight stream from the prior persona
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);

    // Best-effort cloud hydration — only fills if localStorage was empty AND
    // the cloud has real messages (skips first-time visitors with empty cloud).
    if (uid && history.length === 0) {
      let alive = true;
      void loadHumoChat(uid, personaId).then((cloud) => {
        if (!alive || cloud.length === 0) return;
        setMessages(cloud.map((m) => ({ role: m.role, content: m.content })));
      });
      return () => {
        alive = false;
      };
    }
  }, [personaId, persona.greetingUz, uid]);

  // Persist on change (excluding the canned greeting — see above)
  useEffect(() => {
    if (messages.length === 0) return;
    // Only persist if the user has actually sent at least one message
    const hasUserMsg = messages.some((m) => m.role === "user");
    if (!hasUserMsg) return;
    saveHistory(personaId, messages);
  }, [personaId, messages]);

  const send = useCallback(
    async (text: string) => {
      if (streaming) return;

      // Append the user message + an empty streaming assistant message
      const next: ChatMessageView[] = [
        ...messages,
        { role: "user", content: text },
        { role: "assistant", content: "", streaming: true },
      ];
      setMessages(next);
      setStreaming(true);

      // Best-effort cloud-mirror the user message immediately so a refresh
      // mid-stream still preserves the question.
      if (uid) void syncHumoMessage(uid, personaId, { role: "user", content: text });

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const payload = {
          personaId,
          messages: asApiMessages(next.slice(0, -1)), // drop the empty streaming placeholder
          profile: profile
            ? {
                grade: profile.grade,
                interests: profile.interests,
                subInterests: profile.subInterests,
                painPoint: profile.painPoint,
              }
            : null,
        };
        const res = await fetch("/api/humo", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(uid ? { "X-Scorpius-Uid": uid } : {}),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = {
              role: "assistant",
              content: body.message ?? "Xatolik yuz berdi. Qaytadan urinib ko'ring.",
            };
            return copy;
          });
          setStreaming(false);
          return;
        }

        if (!res.body) {
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = {
              role: "assistant",
              content: "Javob kelmadi. Qaytadan urinib ko'ring.",
            };
            return copy;
          });
          setStreaming(false);
          return;
        }

        // Read the SSE stream, parse deltas, append to the last assistant message
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantContent = "";

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx;
          while ((idx = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") {
              continue;
            }
            try {
              const parsed = JSON.parse(payload) as {
                delta?: string;
                error?: string;
                message?: string;
              };
              if (parsed.error) {
                assistantContent +=
                  (assistantContent ? "\n\n" : "") +
                  (parsed.message ?? "Javob uzilib qoldi.");
              } else if (parsed.delta) {
                assistantContent += parsed.delta;
              }
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                  streaming: true,
                };
                return copy;
              });
            } catch {
              /* malformed chunk — skip */
            }
          }
        }
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = {
              role: "assistant",
              content: "Internet xatosi. Qaytadan urinib ko'ring.",
            };
            return copy;
          });
        }
      } finally {
        // Clear the streaming flag on the last assistant message + mirror the
        // final assistant content to the cloud.
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant" && last.streaming) {
            copy[copy.length - 1] = { ...last, streaming: false };
            if (uid && last.content.trim().length > 0) {
              void syncHumoMessage(uid, personaId, {
                role: "assistant",
                content: last.content,
              });
            }
          }
          return copy;
        });
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, personaId, profile, streaming, uid],
  );

  const hasUserMsg = useMemo(() => messages.some((m) => m.role === "user"), [messages]);

  return (
    <main className="flex h-dvh flex-col bg-void-950 pb-[calc(60px+env(safe-area-inset-bottom))]">
      <PersonaHeader persona={persona} onSwitch={() => setPickerOpen(true)} />
      <MessageList persona={persona} messages={messages} />
      <MessageInput
        disabled={streaming || !uid}
        onSend={send}
        starters={hasUserMsg ? undefined : persona.startersUz}
      />
      <BottomNav />
      {pickerOpen && (
        <PersonaPicker
          current={personaId}
          onPick={(id) => {
            setPersonaId(id);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </main>
  );
}
