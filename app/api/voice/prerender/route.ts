// STAGE 1 STUB — voice synthesis planned, not implemented. See STAGE-PLAN.md.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "not_implemented",
      stage: "stage-1",
      message: "Voice prerender is planned but not built yet.",
    },
    { status: 501 },
  );
}
