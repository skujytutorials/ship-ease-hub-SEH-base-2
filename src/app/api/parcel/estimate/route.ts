import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, handle, rateLimit } from "@/lib/http";
import { estimateSchema, quickEstimate } from "@/lib/outbound/estimate";

// Quick price check for anyone: from, to and weight only
export const POST = handle(async (req: Request) => {
  const user = await getCurrentUser();
  await rateLimit(`estimate:${user?.id ?? clientIp(req)}`, user ? 120 : 30, 3600_000);
  const input = estimateSchema.parse(await req.json());
  return NextResponse.json(await quickEstimate(input));
});
