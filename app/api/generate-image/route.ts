// STAGE 1 STUB — image generation planned, not implemented. See STAGE-PLAN.md.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "not_implemented",
      stage: "stage-1",
      message: "Image generation is planned but not built yet.",
    },
    { status: 501 },
  );
}
