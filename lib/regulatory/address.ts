/** Conservative street-line key for address fallback joins. No nearby-address expansion. */

export function streetLineKey(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const beforeComma = value.split(",")[0] ?? value;
  const compact = beforeComma
    .toUpperCase()
    .replace(/#/g, " ")
    .replace(/[^A-Z0-9/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return compact.length > 0 ? compact : null;
}

export function streetLineFromParts(
  houseNumber: string | null | undefined,
  streetName: string | null | undefined,
): string | null {
  const house = houseNumber?.trim() ?? "";
  const street = streetName?.trim() ?? "";
  if (!house || !street) {
    return null;
  }
  return streetLineKey(`${house} ${street}`);
}

export function addressesMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = streetLineKey(left);
  const b = streetLineKey(right);
  return Boolean(a && b && a === b);
}
