"use client";

import { ALL_ROSTER_STUDENTS, LAHS_ROOMS } from "@/lib/lahs-rooms";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useAdminLiveData } from "@/hooks/use-admin-live-data";
import { CampusMap } from "./campus-map";
import { LiveFeed } from "./live-feed";
import { MissingPanel } from "./missing-panel";
import { StatsBar } from "./stats-bar";
import { TeachersPanel } from "./teachers-panel";
import { FirebaseSetupBanner } from "./firebase-setup-banner";

export function AdminDashboard() {
  const live = useAdminLiveData();
  const firebaseOn = isFirebaseConfigured();

  return (
    <div className="flex min-h-screen flex-col bg-[#06080a] text-[#e2e8f0]">
      <FirebaseSetupBanner />
      <StatsBar
        safeCount={live.safeCount}
        unsafeCount={live.unsafeCount}
        missingCount={live.missingStudents.length}
        lastTick={live.lastTick}
        isLive={live.isLive}
        onToggleLive={live.toggleLive}
        onSeedBurst={live.seedBurst}
        dataMode={live.mode}
        firebaseConnected={live.firebaseConnected}
      />

      {firebaseOn && live.mode === "firebase" && live.events.length === 0 ? (
        <p className="border-b border-amber-900/30 bg-amber-950/20 px-4 py-2 text-center text-xs text-amber-200/90">
          Waiting for student check-ins — share{" "}
          <span className="font-mono">/check-in</span> on student phones
        </p>
      ) : null}

      {live.firebaseError ? (
        <p className="border-b border-rose-900/30 bg-rose-950/20 px-4 py-2 text-center text-xs text-rose-300">
          Firebase: {live.firebaseError}
        </p>
      ) : null}

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-12 lg:gap-4 lg:p-4">
        <section className="flex min-h-0 flex-col gap-3 lg:col-span-4 lg:max-h-[calc(100vh-4.25rem)] xl:col-span-3">
          <div className="h-[min(34vh,300px)] shrink-0 lg:h-[36vh] lg:max-h-[320px] lg:min-h-[200px]">
            <LiveFeed events={live.events} />
          </div>
          <div className="h-[min(28vh,220px)] shrink-0 lg:min-h-[140px] lg:flex-1 lg:max-h-none">
            <TeachersPanel
              roomStatsMap={live.roomStatsMap}
              unaccountedIds={live.unaccountedIds}
            />
          </div>
          <MissingPanel students={live.missingStudents} defaultOpen={false} />
        </section>

        <section className="flex min-h-[min(50vh,480px)] flex-col lg:col-span-8 lg:min-h-[calc(100vh-5.5rem)] xl:col-span-9">
          <div className="min-h-0 flex-1">
            <CampusMap
              unaccountedIds={live.unaccountedIds}
              roomStatsMap={live.roomStatsMap}
              teacherByRoom={live.teacherByRoom}
            />
          </div>
          <p className="mt-2 shrink-0 px-1 text-[10px] leading-relaxed text-[#475569]">
            {live.mode === "firebase"
              ? `${live.events.length} checked in · ${LAHS_ROOMS.length} rooms · click a tile for roster`
              : `Demo · ${LAHS_ROOMS.length} rooms · ${ALL_ROSTER_STUDENTS.length} students · click room for detail`}
          </p>
        </section>
      </main>
    </div>
  );
}
