type BadgeTone = "neutral" | "accent" | "review" | "alert";

const TONE: Record<BadgeTone, string> = {
  neutral: "border-line bg-paper text-ink-muted",
  accent: "border-accent/20 bg-accent-soft text-accent",
  review: "border-review/20 bg-review-soft text-review",
  alert: "border-alert/20 bg-alert-soft text-alert",
};

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: string;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}
