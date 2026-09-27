import {
  chatAboutParcel,
  chatUnavailable,
  parseChatTurns,
  parseClaudeAnalysisInput,
  parseUserMessage,
} from "@/lib/claude/chat";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      context?: unknown;
      history?: unknown;
      message?: unknown;
    };
    const context = parseClaudeAnalysisInput(body.context);
    const history = parseChatTurns(body.history ?? []);
    const message = parseUserMessage(body.message);
    if (!context || !history || !message) {
      return NextResponse.json(chatUnavailable(), { status: 200 });
    }

    const result = await chatAboutParcel({ context, history, message });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(chatUnavailable(), { status: 200 });
  }
}
