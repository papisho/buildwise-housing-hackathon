export function readHudUserApiToken(): string | null {
  const token = process.env.HUD_USER_API_TOKEN?.trim();
  return token && token.length > 0 ? token : null;
}
