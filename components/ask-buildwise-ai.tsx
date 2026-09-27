"use client";

import { useState } from "react";
import {
  CLAUDE_CHAT_UNAVAILABLE_MESSAGE,
  MAX_CHAT_USER_CHARS,
} from "@/lib/claude/chat-limits";
import type { ChatTurn, ClaudeAnalysisInput } from "@/lib/claude/types";

const SUGGESTED_PROMPTS = [
  "What are the biggest barriers for this proposal?",
  "What should I verify first?",
  "Explain the zoning result in plain English.",
  "What evidence is still missing?",
  "Create a due-diligence checklist for this parcel.",
] as const;

type VisibleMessage = ChatTurn;

export function AskBuildWiseAI({
  context,
}: {
  context: ClaudeAnalysisInput;
  sessionKey: string;
}) {
  const [messages, setMessages] = useState<VisibleMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function sendMessage(text: string) {
    const message = text.trim();
    if (!message || sending) {
      return;
    }

    setFailure(null);
    setSending(true);
    setDraft("");
    const history = messages;
    setMessages((current) => [...current, { role: "user", content: message }]);

    try {
      const response = await fetch("/api/parcel-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          context,
          history,
          message,
        }),
      });
      const body = (await response.json()) as {
        status?: unknown;
        reply?: unknown;
        message?: unknown;
      };
      if (body.status === "ok" && typeof body.reply === "string") {
        setMessages((current) => [
          ...current,
          { role: "assistant", content: body.reply as string },
        ]);
        return;
      }
      setFailure(
        typeof body.message === "string"
          ? body.message
          : CLAUDE_CHAT_UNAVAILABLE_MESSAGE,
      );
    } catch {
      setFailure(CLAUDE_CHAT_UNAVAILABLE_MESSAGE);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-accent/20 bg-accent-soft/40 shadow-sm">
      <div className="border-b border-accent/15 bg-surface px-5 py-4">
        <h2 className="text-lg font-semibold">Ask BuildWise AI</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Ask about this parcel, its constraints, missing evidence, or next
          steps.
        </p>
      </div>

      <div className="px-5 py-4">
        <div className="max-h-80 space-y-3 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No questions yet. Use a suggested prompt or type your own.
            </p>
          ) : (
            messages.map((item, index) => (
              <div
                key={`${item.role}-${index}`}
                className={
                  item.role === "user"
                    ? "ml-8 rounded-lg bg-accent px-3 py-2 text-sm text-white"
                    : "mr-8 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                }
              >
                <p
                  className={
                    item.role === "user"
                      ? "text-xs font-medium tracking-wide text-white/80 uppercase"
                      : "text-xs font-medium tracking-wide text-ink-muted uppercase"
                  }
                >
                  {item.role === "user" ? "You" : "BuildWise AI"}
                </p>
                <p className="mt-1 whitespace-pre-wrap leading-6">{item.content}</p>
              </div>
            ))
          )}
          {sending ? (
            <p className="text-sm text-ink-muted">Thinking…</p>
          ) : null}
        </div>

        {failure ? (
          <p
            className="mt-3 rounded-lg border border-alert/25 bg-alert-soft p-3 text-sm text-alert"
            role="alert"
          >
            {failure}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={sending}
              onClick={() => void sendMessage(prompt)}
              className="cursor-pointer rounded-full border border-line bg-surface px-3 py-1.5 text-left text-xs text-ink disabled:cursor-wait disabled:opacity-80"
            >
              {prompt}
            </button>
          ))}
        </div>

        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage(draft);
          }}
        >
          <label htmlFor="ask-buildwise" className="sr-only">
            Question about this parcel
          </label>
          <input
            id="ask-buildwise"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={MAX_CHAT_USER_CHARS}
            disabled={sending}
            placeholder="Ask a question about this parcel analysis"
            className="bw-input min-w-0 flex-1"
          />
          <button
            type="submit"
            disabled={sending || draft.trim().length === 0}
            className="bw-btn w-full sm:w-auto"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </form>
      </div>
    </section>
  );
}
