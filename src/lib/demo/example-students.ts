export type ExampleStudent = {
  id: string;
  fullName: string;
  grade: string;
};

const EXAMPLE_STUDENT_NAMES = [
  "Alyssa Wang",
  "Lydia Chen",
  "Ethan Brooks",
  "Maya Singh",
  "Jacob Lee",
  "Priya Patel",
  "Mateo Garcia",
  "Jordan Kim",
  "Emma Nguyen",
  "Daniel Park",
  "Noah Patel",
  "Sophia Martinez",
  "Lucas Brown",
  "Isabella Wilson",
  "Mason Nguyen",
  "Mia Rivera",
  "Logan Foster",
  "Amelia Hayes",
  "James Cohen",
  "Harper Ward",
  "Benjamin Ross",
  "Evelyn Price",
  "Henry Bell",
  "Charlotte Murphy",
  "William Cole",
  "Ava Kim",
  "Elijah Singh",
  "Grace Lee",
  "Leo Chen",
  "Nora Garcia",
  "Owen Patel",
  "Chloe Wang",
  "Aria Nguyen",
  "Sam Rivera",
  "Ruby Martinez",
  "Julian Park",
  "Sofia Brooks",
  "Miles Cohen",
  "Ella Brown",
  "Kai Wilson",
  "Riley Ward",
  "Zoe Price",
  "Theo Foster",
  "Luna Hayes",
  "Caleb Bell",
  "Violet Murphy",
  "Isaac Cole",
  "Hazel Ross",
  "Ryan Kim",
  "Mila Singh",
  "Adrian Garcia",
  "Leah Patel",
  "Finn Nguyen",
  "Ivy Lee",
  "Eli Martinez",
  "Naomi Park",
  "Jonah Chen",
  "Maya Wang",
  "Omar Rivera",
  "Tessa Brooks",
];

const EXTRA_EXAMPLE_STUDENTS: ExampleStudent[] = [
  { id: "LAHS-1061", fullName: "Jay Roy", grade: "10" },
];

export const EXAMPLE_STUDENTS: ExampleStudent[] = [
  ...EXAMPLE_STUDENT_NAMES.map((fullName, index) => ({
    id: `LAHS-${String(index + 1001).padStart(4, "0")}`,
    fullName,
    grade: String(9 + (index % 4)),
  })),
  ...EXTRA_EXAMPLE_STUDENTS,
];

export function exampleStudentByName(fullName: string): ExampleStudent | undefined {
  return EXAMPLE_STUDENTS.find((student) => student.fullName === fullName);
}
