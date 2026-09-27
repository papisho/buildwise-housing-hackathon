import { BuildWiseLogo } from "@/components/logo";

const NAV = [
  { href: "#home", label: "Home" },
  { href: "#analyze", label: "Analyze" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#about", label: "About" },
  { href: "#sources", label: "Sources" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <a href="#home" className="shrink-0 rounded-md">
          <BuildWiseLogo compact />
        </a>

        <nav className="hidden items-center gap-6 text-sm md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-ink-muted hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <a href="#analyze" className="bw-btn px-3 py-2 text-sm">
            Analyze
          </a>
          <details className="relative">
            <summary className="flex h-10 w-10 list-none items-center justify-center rounded-md border border-line bg-surface text-sm [&::-webkit-details-marker]:hidden">
              <span className="sr-only">Menu</span>
              <span aria-hidden="true">☰</span>
            </summary>
            <nav
              className="absolute right-0 z-50 mt-2 w-52 rounded-lg border border-line bg-surface p-2 shadow-sm"
              aria-label="Mobile"
            >
              <ul className="flex flex-col">
                {NAV.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className="block rounded-md px-2 py-2 text-sm text-ink"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
