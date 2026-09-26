import { findParcelForAddress } from "@/lib/lookup/address-to-parcel";
import { parseProposedProjectType } from "@/lib/project-type";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let address = "";
  let proposedProjectType = parseProposedProjectType(undefined);

  try {
    const body = (await request.json()) as {
      address?: unknown;
      proposedProjectType?: unknown;
    };
    if (typeof body.address === "string") {
      address = body.address;
    }
    proposedProjectType = parseProposedProjectType(body.proposedProjectType);
  } catch {
    return NextResponse.json(
      {
        status: "invalid_input",
        message: "Send JSON with an address string.",
      },
      { status: 400 },
    );
  }

  const result = await findParcelForAddress(address, proposedProjectType);
  const httpStatus = result.status === "invalid_input" ? 400 : 200;
  return NextResponse.json(result, { status: httpStatus });
}
