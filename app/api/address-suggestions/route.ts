import { NextResponse } from "next/server";

const SUGGEST_URL =
  "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest";

type ArcGisSuggestion = { text?: unknown };

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 3 || query.length > 100) {
    return NextResponse.json({ suggestions: [] });
  }

  const params = new URLSearchParams({
    f: "json",
    text: query,
    location: "-79.9959,40.4406",
    searchExtent: "-80.10,40.35,-79.85,40.52",
    maxSuggestions: "8",
  });

  try {
    const response = await fetch(`${SUGGEST_URL}?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new Error(`Suggestion service returned ${response.status}`);
    }
    const data: { suggestions?: ArcGisSuggestion[]; error?: unknown } =
      await response.json();
    if (data.error || !Array.isArray(data.suggestions)) {
      throw new Error("Suggestion service returned an invalid response");
    }

    const suggestions = data.suggestions
      .map((item) => item.text)
      .filter(
        (text): text is string =>
          typeof text === "string" &&
          /^\d+[a-z]?\s/i.test(text) &&
          /,\s*Pittsburgh,\s*PA,\s*\d{5}/i.test(text),
      )
      .map((text) => text.replace(/,\s*USA$/i, ""))
      .slice(0, 6);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Address suggestions unavailable", error);
    return NextResponse.json(
      { error: "Suggestions unavailable. Enter the full address manually." },
      { status: 502 },
    );
  }
}