import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { getClientFirestore } from "./config";
import { ROOM_OPTIONS } from "@/lib/lahs-rooms/room-options";

export type FirestoreRoom = {
  number: string;
  label: string;
  building: string;
  teacher: string;
};

export async function fetchRoomsFromFirestore(): Promise<FirestoreRoom[]> {
  const db = getClientFirestore();
  const snap = await getDocs(query(collection(db, "rooms"), orderBy("number")));
  if (snap.empty) return [];
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      number: data.number ?? d.id,
      label: data.label ?? `Room ${d.id}`,
      building: data.building ?? "",
      teacher: data.teacher ?? "",
    };
  });
}

export function fallbackRooms(): FirestoreRoom[] {
  return ROOM_OPTIONS.map((r) => ({
    number: r.value,
    label: r.label,
    building: r.building,
    teacher: r.teacher,
  }));
}
