import {
  resourcesForVerificationStep,
  VERIFICATION_PORTALS,
} from "@/lib/review/verification-resources";

export function VerificationLinks({ step }: { step: string }) {
  const resources = resourcesForVerificationStep(step);
  if (!resources.length) return null;

  return (
    <div className="verification-step-links mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {resources.map((resource) => (
        <a
          key={resource.href}
          href={resource.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${resource.label} (opens in a new tab)`}
          className="font-semibold text-accent underline"
        >
          {resource.label}
        </a>
      ))}
    </div>
  );
}

export function VerificationPortals() {
  return (
    <span>
      {VERIFICATION_PORTALS.map((resource, index) => (
        <span key={resource.href}>
          {index > 0 ? " · " : ""}
          <a
            href={resource.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${resource.label} (opens in a new tab)`}
          >
            {resource.label}
          </a>
        </span>
      ))}
    </span>
  );
}