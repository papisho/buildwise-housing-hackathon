"use server";

import { findParcelForAddress } from "@/lib/lookup/address-to-parcel";
import type { AddressToParcelResult } from "@/lib/lookup/address-to-parcel";
import { parseProposedProjectType } from "@/lib/project-type";

export async function findParcelAction(
  _previous: AddressToParcelResult | null,
  formData: FormData,
): Promise<AddressToParcelResult> {
  const address = String(formData.get("address") ?? "");
  const proposedProjectType = parseProposedProjectType(
    formData.get("proposedProjectType"),
  );
  return findParcelForAddress(address, proposedProjectType);
}
