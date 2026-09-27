import { readClaudeApiKey, readClaudeModel } from "@/lib/claude/env";
import {
  CLAUDE_SYSTEM_PROMPT,
  buildClaudeAnalysisInput,
} from "@/lib/claude/payload";
import type {
  ClaudeAnalysisInput,
  ClaudeExplanationResult,
  ClaudeNarrative,
} from "@/lib/claude/types";

export const CLAUDE_MODEL = "claude-sonnet-4-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const REQUEST_TIMEOUT_MS = 35_000;
const UNAVAILABLE_MESSAGE =
  "AI explanation unavailable. Structured evidence and recommended verification remain available.";

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>;
  error?: { message?: string };
};

function readApiKey(): string | null {
  return readClaudeApiKey();
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Claude response was not JSON.");
  }
  return JSON.parse(candidate.slice(start, end + 1)) as unknown;
}

function asStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, max);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Claude response missed ${key}.`);
  }
  return value.trim();
}

function parseNarrative(payload: unknown): ClaudeNarrative {
  if (!payload || typeof payload !== "object") {
    throw new Error("Claude response was not an object.");
  }
  const record = payload as Record<string, unknown>;
  return {
    summary: requiredString(record, "summary"),
    key_bottlenecks: asStringArray(record.key_bottlenecks, 3),
    constraint_interactions: asStringArray(record.constraint_interactions, 3),
    why_this_matters: requiredString(record, "why_this_matters"),
    what_could_change_the_result: asStringArray(
      record.what_could_change_the_result,
      3,
    ),
    questions_for_human_review: asStringArray(
      record.questions_for_human_review,
      4,
    ),
    limitations: requiredString(record, "limitations"),
  };
}

export async function explainAnalysis(
  input: ClaudeAnalysisInput,
): Promise<ClaudeExplanationResult> {
  const apiKey = readApiKey();
  if (!apiKey) {
    return { status: "unavailable", message: UNAVAILABLE_MESSAGE };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: readClaudeModel(),
        max_tokens: 1200,
        temperature: 0,
        system: CLAUDE_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: JSON.stringify(input),
          },
        ],
      }),
    });

    if (!response.ok) {
      return { status: "unavailable", message: UNAVAILABLE_MESSAGE };
    }

    const body = (await response.json()) as AnthropicResponse;
    const text = body.content
      ?.filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text ?? "")
      .join("\n")
      .trim();
    if (!text) {
      return { status: "unavailable", message: UNAVAILABLE_MESSAGE };
    }

    return {
      status: "ok",
      narrative: parseNarrative(extractJsonObject(text)),
    };
  } catch {
    return { status: "unavailable", message: UNAVAILABLE_MESSAGE };
  } finally {
    clearTimeout(timer);
  }
}

export { buildClaudeAnalysisInput };
