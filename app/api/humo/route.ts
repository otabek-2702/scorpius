// STAGE 1 STUB — streaming chat endpoint planned, not implemented. See STAGE-PLAN.md.
import { NextResponse } from "next/server";

const NOT_BUILT = {
  error: "not_implemented",
  stage: "stage-1",
  message: "The Humo chat endpoint is planned but not built yet.",
};

export async function POST() {
  return NextResponse.json(NOT_BUILT, { status: 501 });
}
