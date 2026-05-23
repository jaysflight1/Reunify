import { NextResponse } from "next/server";
import { isFirebaseAdminConfigured, seedFirestoreCatalog } from "@/lib/firebase/admin";
import { ACTIVE_DRILL_ID } from "@/lib/firebase/config";
import { ROOM_OPTIONS } from "@/lib/lahs-rooms/room-options";

export async function POST() {
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json(
      {
        error:
          "Add FIREBASE_SERVICE_ACCOUNT_JSON to .env.local, then restart the dev server.",
      },
      { status: 503 },
    );
  }

  try {
    const rooms = ROOM_OPTIONS.map((r) => ({
      number: r.value,
      label: r.label,
      building: r.building,
      teacher: r.teacher,
    }));
    const result = await seedFirestoreCatalog(ACTIVE_DRILL_ID, rooms);
    return NextResponse.json({
      ok: true,
      drillId: ACTIVE_DRILL_ID,
      ...result,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Seed failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
