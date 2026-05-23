import { ALL_ROSTER_STUDENTS, type RoomStudent } from "@/lib/lahs-rooms";

export type DemoParent = {
  id: string;
  fullName: string;
  children: RoomStudent[];
};

const PARENT_FIRST_NAMES = [
  "Alex",
  "Beth",
  "Carlos",
  "Dana",
  "Eli",
  "Farah",
  "Greg",
  "Hannah",
  "Ian",
  "Jasmine",
  "Khalil",
  "Linda",
  "Marcus",
  "Nina",
  "Oscar",
  "Paula",
  "Quincy",
  "Rachel",
  "Sergio",
  "Tina",
  "Umar",
  "Vera",
  "Wesley",
  "Xenia",
  "Yusuf",
  "Zara",
];

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

function lastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1]! : fullName;
}

const MANUAL_PARENTS: DemoParent[] = [
  {
    id: "parent-of-alyssa-wang",
    fullName: "Janet Wang",
    children: [
      { id: "student-alyssa-wang", name: "Alyssa Wang", grade: "9" },
    ],
  },
  {
    id: "parent-of-jay-roy",
    fullName: "Ann Roy",
    children: [{ id: "student-jay-roy", name: "Jay Roy", grade: "10" }],
  },
];

const manualChildIds = new Set(
  MANUAL_PARENTS.flatMap((parent) => parent.children.map((child) => child.id)),
);

const generatedParents: DemoParent[] = ALL_ROSTER_STUDENTS.filter(
  (student) => !manualChildIds.has(student.id),
).map((student, index) => {
  const firstIdx = (hash(student.id) + index * 13) % PARENT_FIRST_NAMES.length;
  const first = PARENT_FIRST_NAMES[firstIdx]!;
  const last = lastName(student.name);
  return {
    id: `parent-of-${student.id}`,
    fullName: `${first} ${last}`,
    children: [student],
  };
});

function dedupe(parents: DemoParent[]): DemoParent[] {
  const seen = new Set<string>();
  const out: DemoParent[] = [];
  for (const parent of parents) {
    const key = parent.fullName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parent);
  }
  return out;
}

export const DEMO_PARENTS: DemoParent[] = dedupe([
  ...MANUAL_PARENTS,
  ...generatedParents,
]).sort((a, b) => a.fullName.localeCompare(b.fullName));

export function findDemoParents(query: string, limit = 8): DemoParent[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: DemoParent[] = [];
  for (const parent of DEMO_PARENTS) {
    if (parent.fullName.toLowerCase().includes(q)) {
      out.push(parent);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function demoParentById(id: string | null): DemoParent | null {
  if (!id) return null;
  return DEMO_PARENTS.find((p) => p.id === id) ?? null;
}
