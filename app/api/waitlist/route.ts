// STAGE 1 STUB — waitlist endpoint planned, not implemented. See STAGE-PLAN.md.
import { NextResponse } from "next/server";

const NOT_BUILT = {
  error: "not_implemented",
  stage: "stage-1",
  message: "The waitlist endpoint is planned but not built yet.",
};

export async function GET() {
  return NextResponse.json({ ...NOT_BUILT, count: 0 }, { status: 501 });
}

export async function POST() {
  return NextResponse.json(NOT_BUILT, { status: 501 });
}
