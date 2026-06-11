import { ALL_ROSTER_STUDENTS, type RoomStudent } from "@/lib/general-rooms";

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

const PARENT_LAST_NAMES = [
  "Adams",
  "Bennett",
  "Brooks",
  "Carter",
  "Diaz",
  "Edwards",
  "Flores",
  "Grant",
  "Harris",
  "Ibrahim",
  "Johnson",
  "Keller",
  "Lopez",
  "Morgan",
  "Nelson",
  "Ortiz",
  "Parker",
  "Quinn",
  "Reed",
  "Santos",
  "Turner",
  "Usman",
  "Valdez",
  "Walker",
  "Xu",
  "Young",
  "Zimmerman",
  "Bishop",
  "Carson",
  "Dominguez",
  "Ellis",
  "Franklin",
  "Gomez",
  "Hughes",
  "Ingram",
  "Jacobs",
  "Khan",
  "Lambert",
  "Morris",
  "Owens",
];

const MANUAL_PARENTS: DemoParent[] = [
  {
    id: "parent-of-alyssa-wang",
    fullName: "Janet Wang",
    children: [
      { id: "GHS-1001", name: "Alyssa Wang", grade: "9" },
    ],
  },
  {
    id: "parent-of-jay-roy",
    fullName: "Ann Roy",
    children: [{ id: "GHS-1061", name: "Jay Roy", grade: "10" }],
  },
];

const manualChildIds = new Set(
  MANUAL_PARENTS.flatMap((parent) => parent.children.map((child) => child.id)),
);

const generatedParents: DemoParent[] = ALL_ROSTER_STUDENTS.filter(
  (student) => !manualChildIds.has(student.id),
).map((student, index) => {
  const first = PARENT_FIRST_NAMES[index % PARENT_FIRST_NAMES.length]!;
  const last =
    PARENT_LAST_NAMES[Math.floor(index / PARENT_FIRST_NAMES.length) % PARENT_LAST_NAMES.length]!;
  return {
    id: `parent-of-${student.id}`,
    fullName: `${first} ${last}`,
    children: [student],
  };
});

function ensureUniqueParentNames(parents: DemoParent[]): DemoParent[] {
  const seen = new Set<string>();
  return parents.map((parent) => {
    let fullName = parent.fullName;
    let key = fullName.toLowerCase();
    let suffix = 2;
    while (seen.has(key)) {
      fullName = `${parent.fullName} ${suffix}`;
      key = fullName.toLowerCase();
      suffix++;
    }
    seen.add(key);
    return fullName === parent.fullName ? parent : { ...parent, fullName };
  });
}

export const DEMO_PARENTS: DemoParent[] = ensureUniqueParentNames([
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
