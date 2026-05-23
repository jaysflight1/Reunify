export { CAMPUS_MAP, RALLY_POINT } from "./campus-map-config";

export type Status = "safe" | "unsafe";

export function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
