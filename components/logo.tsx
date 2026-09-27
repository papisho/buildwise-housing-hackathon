export function BuildWiseLogo({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-ink">
      <svg
        width={compact ? 28 : 32}
        height={compact ? 28 : 32}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="7" fill="#1b4f4a" />
        <path
          d="M8.5 22.5V13.2L16 8.5l7.5 4.7v9.3H8.5Z"
          stroke="#f4f1ea"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M13 22.5v-5.2h6v5.2"
          stroke="#f4f1ea"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M12.2 16.1l2.1 2.1 4.5-4.6"
          stroke="#f4f1ea"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className={
          compact
            ? "text-base font-semibold tracking-tight"
            : "text-lg font-semibold tracking-tight"
        }
      >
        BuildWise
      </span>
    </span>
  );
}
