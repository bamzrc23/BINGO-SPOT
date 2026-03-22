import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "bingo-online-proyecto",
    timestamp: new Date().toISOString()
  });
}
