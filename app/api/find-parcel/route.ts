import { findParcelForAddress } from "@/lib/lookup/address-to-parcel";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let address = "";

  try {
    const body = (await request.json()) as { address?: unknown };
    if (typeof body.address === "string") {
      address = body.address;
    }
  } catch {
    return NextResponse.json(
      {
        status: "invalid_input",
        message: "Send JSON with an address string.",
      },
      { status: 400 },
    );
  }

  const result = await findParcelForAddress(address);
  const httpStatus = result.status === "invalid_input" ? 400 : 200;
  return NextResponse.json(result, { status: httpStatus });
}
