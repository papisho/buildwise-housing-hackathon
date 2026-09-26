"use server";

import { findParcelForAddress } from "@/lib/lookup/address-to-parcel";
import type { AddressToParcelResult } from "@/lib/lookup/address-to-parcel";

export async function findParcelAction(
  _previous: AddressToParcelResult | null,
  formData: FormData,
): Promise<AddressToParcelResult> {
  const address = String(formData.get("address") ?? "");
  return findParcelForAddress(address);
}
