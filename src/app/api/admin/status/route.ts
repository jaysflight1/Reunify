import { NextResponse } from "next/server";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isFirebaseConfigured, ACTIVE_DRILL_ID } from "@/lib/firebase/config";

export async function GET() {
  return NextResponse.json({
    clientConfigured: isFirebaseConfigured(),
    adminConfigured: isFirebaseAdminConfigured(),
    drillId: ACTIVE_DRILL_ID,
    collections: {
      rooms: "Room number, label, building, teacher (seed via POST /api/admin/seed)",
      reports:
        "Student check-ins: name, id, grade, status, room, teacher, location, note",
      drills: "Active drill metadata",
    },
  });
}
