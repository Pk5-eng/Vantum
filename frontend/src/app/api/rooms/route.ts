import { NextResponse } from "next/server";
import { getAllRooms } from "@/lib/store";

export async function GET() {
  const rooms = getAllRooms();
  return NextResponse.json({ rooms });
}
