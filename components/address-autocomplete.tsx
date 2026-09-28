"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  address: string;
  onChange: (address: string) => void;
  pending: boolean;
};

export function AddressAutocomplete({ address, onChange, pending }: Props) {
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selectedAddress = useRef("");

  useEffect(() => {
    if (!focused || pending || address.trim().length < 3 || address === selectedAddress.current) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/address-suggestions?q=${encodeURIComponent(address.trim())}`,
          { signal: controller.signal },
        );
        const data: { suggestions?: string[]; error?: string } =
          await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Suggestions unavailable.");
        }
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        setActiveIndex(-1);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setError(
          caught instanceof Error
            ? caught.message
            : "Suggestions unavailable. Enter the full address manually.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [address, focused, pending]);

  function choose(suggestion: string) {
    selectedAddress.current = suggestion;
    onChange(suggestion);
    setSuggestions([]);
    setActiveIndex(-1);
    setFocused(false);
    setError("");
  }

  const showList = focused && !pending && suggestions.length > 0;

  return (
    <div className="relative min-w-0">
      <label htmlFor="address" className="text-sm font-semibold">
        Address
      </label>
      <input
        id="address"
        name="address"
        type="text"
        value={address}
        onChange={(event) => {
          selectedAddress.current = "";
          setFocused(true);
          setSuggestions([]);
          setError("");
          onChange(event.target.value);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setActiveIndex(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setSuggestions([]);
            setActiveIndex(-1);
          } else if (showList && event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % suggestions.length);
          } else if (showList && event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) =>
              index <= 0 ? suggestions.length - 1 : index - 1,
            );
          } else if (showList && event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            choose(suggestions[activeIndex]);
          }
        }}
        placeholder="414 Grant Street, Pittsburgh, PA 15219"
        autoComplete="off"
        required
        aria-describedby="address-guidance address-suggestion-status"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={showList ? "address-suggestions" : undefined}
        aria-activedescendant={
          showList && activeIndex >= 0
            ? `address-suggestion-${activeIndex}`
            : undefined
        }
        className="bw-input mt-1.5"
      />
      <span id="address-suggestion-status" className="sr-only" role="status">
        {error || (loading ? "Finding Pittsburgh addresses" : "")}
      </span>
      {showList ? (
        <ul
          id="address-suggestions"
          role="listbox"
          aria-label="Suggested Pittsburgh addresses"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-lg"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              id={`address-suggestion-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={`cursor-pointer rounded-md px-3 py-2 text-sm ${
                index === activeIndex ? "bg-paper font-medium" : "hover:bg-paper"
              }`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(suggestion)}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      ) : null}
      {focused && error ? (
        <p className="mt-1 text-xs text-ink-muted">{error}</p>
      ) : null}
    </div>
  );
}