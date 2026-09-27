export function readClaudeApiKey(): string | null {
  const key = process.env.CLAUDE_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

export function readClaudeModel(): string {
  const model = process.env.CLAUDE_MODEL?.trim();
  return model && model.length > 0 ? model : "claude-sonnet-4-5";
}
