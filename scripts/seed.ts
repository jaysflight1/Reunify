import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type WriteBatch } from "firebase-admin/firestore";
import {
  DEMO_APP_USERS,
  DEMO_CLASS_47_ID,
  DEMO_GYM_ID,
  DEMO_INCIDENT_ID,
  DEMO_PARENT_ANN_ROY_ID,
  DEMO_PICKUP_ZONE_B_ID,
  DEMO_ROOM_44_ID,
  DEMO_ROOM_602_ID,
  DEMO_SCHOOL_ID,
  DEMO_STUDENT_JAY_ROY_ID,
  DEMO_CLASS_602_ID,
} from "../src/lib/demo/constants";
import { EXAMPLE_STUDENTS, exampleStudentByName } from "../src/lib/demo/example-students";
import type { AppUser, UserRole } from "../src/types/user";
import type {
  ClassGroup,
  Incident,
  Location,
  Student,
  StudentIncidentState,
} from "../src/types/incident";

const NOW = new Date("2026-05-23T12:00:00.000Z").toISOString();

type SeedData = {
  school: { id: string; name: string; activeIncidentId: string; updatedAt: string };
  users: AppUser[];
  students: Student[];
  classes: ClassGroup[];
  locations: Location[];
  incident: Incident;
  studentStates: StudentIncidentState[];
};

function splitName(fullName: string): { firstName: string; lastName: string } {
  const [firstName = "", ...rest] = fullName.split(" ");
  return { firstName, lastName: rest.join(" ") };
}

function studentIdForName(name: string): string {
  const student = exampleStudentByName(name);
  if (!student) throw new Error(`Unknown example student: ${name}`);
  return student.id;
}

function makeStudent(example: (typeof EXAMPLE_STUDENTS)[number], classIds: string[]): Student {
  const { firstName, lastName } = splitName(example.fullName);
  return {
    id: example.id,
    schoolId: DEMO_SCHOOL_ID,
    firstName,
    lastName,
    fullName: example.fullName,
    grade: example.grade,
    classIds,
    primaryClassId: classIds[0],
    parentGuardianIds:
      example.fullName === "Alyssa Wang"
        ? [DEMO_APP_USERS.parent]
        : example.fullName === "Jay Roy"
          ? [DEMO_PARENT_ANN_ROY_ID]
          : [],
    authorizedPickupGuardianIds:
      example.fullName === "Alyssa Wang"
        ? [DEMO_APP_USERS.parent]
        : example.fullName === "Jay Roy"
          ? [DEMO_PARENT_ANN_ROY_ID]
          : [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeUser(role: UserRole, displayName: string, extra: Partial<AppUser> = {}): AppUser {
  return {
    id: DEMO_APP_USERS[role],
    schoolId: DEMO_SCHOOL_ID,
    role,
    displayName,
    isDemoUser: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...extra,
  };
}

function buildSeedData(): SeedData {
  const classIds = ["class-47", "class-gym-a", "class-field-b", "class-cafeteria-c"];
  const class47Ids = EXAMPLE_STUDENTS.slice(0, 27).map((student) => student.id);
  const gymClassIds = EXAMPLE_STUDENTS.slice(27, 42).map((student) => student.id);
  const fieldClassIds = EXAMPLE_STUDENTS.slice(42, 52).map((student) => student.id);
  const cafeteriaClassIds = EXAMPLE_STUDENTS.slice(52).map((student) => student.id);

  const students = EXAMPLE_STUDENTS.map((student, index) => {
    if (student.fullName === "Jay Roy") {
      return makeStudent(student, [DEMO_CLASS_602_ID]);
    }
    const classId =
      index < 27 ? classIds[0]! : index < 42 ? classIds[1]! : index < 52 ? classIds[2]! : classIds[3]!;
    return makeStudent(student, [classId]);
  });

  const classes: ClassGroup[] = [
    {
      id: DEMO_CLASS_47_ID,
      schoolId: DEMO_SCHOOL_ID,
      name: "Class 47",
      teacherUserId: DEMO_APP_USERS.teacher,
      teacherName: "Ms. Rivera",
      studentIds: class47Ids,
      roomId: DEMO_ROOM_44_ID,
      roomLabel: "Room 44",
    },
    {
      id: "class-gym-a",
      schoolId: DEMO_SCHOOL_ID,
      name: "Gym Group A",
      teacherUserId: "demo-teacher-coach-kim",
      teacherName: "Coach Kim",
      studentIds: gymClassIds,
      roomId: DEMO_GYM_ID,
      roomLabel: "Gym",
    },
    {
      id: "class-field-b",
      schoolId: DEMO_SCHOOL_ID,
      name: "Field Group B",
      teacherUserId: "demo-teacher-mr-patel",
      teacherName: "Mr. Patel",
      studentIds: fieldClassIds,
      roomId: "field",
      roomLabel: "Field",
    },
    {
      id: "class-cafeteria-c",
      schoolId: DEMO_SCHOOL_ID,
      name: "Cafeteria Group C",
      teacherUserId: "demo-teacher-ms-nguyen",
      teacherName: "Ms. Nguyen",
      studentIds: cafeteriaClassIds,
      roomId: "cafeteria",
      roomLabel: "Cafeteria",
    },
    {
      id: DEMO_CLASS_602_ID,
      schoolId: DEMO_SCHOOL_ID,
      name: "Room 602",
      teacherUserId: "demo-teacher-ms-ross",
      teacherName: "Ms. Ross",
      studentIds: [studentIdForName("Jay Roy")],
      roomId: DEMO_ROOM_602_ID,
      roomLabel: "Room 602",
    },
  ];

  const locations: Location[] = [
    {
      id: DEMO_ROOM_44_ID,
      schoolId: DEMO_SCHOOL_ID,
      label: "Room 44",
      zone: "Building A",
      type: "classroom",
      parentSafeLabel: "with school staff",
      x: 44,
      y: 32,
    },
    {
      id: "room-21",
      schoolId: DEMO_SCHOOL_ID,
      label: "Room 21",
      zone: "Building B",
      type: "classroom",
      parentSafeLabel: "with school staff",
      x: 58,
      y: 40,
    },
    {
      id: DEMO_GYM_ID,
      schoolId: DEMO_SCHOOL_ID,
      label: "Gym",
      zone: "Athletics",
      type: "gym",
      parentSafeLabel: "with school staff",
      x: 72,
      y: 58,
    },
    {
      id: "cafeteria",
      schoolId: DEMO_SCHOOL_ID,
      label: "Cafeteria",
      zone: "Student Center",
      type: "other",
      parentSafeLabel: "with school staff",
      x: 38,
      y: 62,
    },
    {
      id: "field",
      schoolId: DEMO_SCHOOL_ID,
      label: "Field",
      zone: "Outdoor",
      type: "field",
      parentSafeLabel: "designated safe area",
      x: 80,
      y: 80,
    },
    {
      id: "nurse-office",
      schoolId: DEMO_SCHOOL_ID,
      label: "Nurse Office",
      zone: "Administration",
      type: "nurse",
      parentSafeLabel: "with medical staff",
      x: 24,
      y: 44,
    },
    {
      id: DEMO_PICKUP_ZONE_B_ID,
      schoolId: DEMO_SCHOOL_ID,
      label: "Pickup Zone B",
      zone: "Dismissal",
      type: "pickup",
      parentSafeLabel: "pickup zone",
      x: 12,
      y: 86,
    },
    {
      id: DEMO_ROOM_602_ID,
      schoolId: DEMO_SCHOOL_ID,
      label: "Room 602",
      zone: "600 Wing",
      type: "classroom",
      parentSafeLabel: "with school staff",
      x: 82,
      y: 8,
    },
  ];

  const users: AppUser[] = [
    makeUser("admin", "Demo Admin"),
    makeUser("teacher", "Ms. Rivera", { assignedClassIds: [DEMO_CLASS_47_ID] }),
    makeUser("student", "Lydia Chen", { linkedStudentId: studentIdForName("Lydia Chen") }),
    makeUser("parent", "Janet Wang", {
      linkedStudentIds: [studentIdForName("Alyssa Wang")],
    }),
    makeUser("responder", "Demo Responder"),
    {
      id: DEMO_STUDENT_JAY_ROY_ID,
      schoolId: DEMO_SCHOOL_ID,
      role: "student",
      displayName: "Jay Roy",
      linkedStudentId: studentIdForName("Jay Roy"),
      isDemoUser: true,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: DEMO_PARENT_ANN_ROY_ID,
      schoolId: DEMO_SCHOOL_ID,
      role: "parent",
      displayName: "Ann Roy",
      linkedStudentIds: [studentIdForName("Jay Roy")],
      isDemoUser: true,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: "demo-teacher-ms-ross",
      schoolId: DEMO_SCHOOL_ID,
      role: "teacher",
      displayName: "Ms. Ross",
      assignedClassIds: [DEMO_CLASS_602_ID],
      isDemoUser: true,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ];

  const incident: Incident = {
    id: DEMO_INCIDENT_ID,
    schoolId: DEMO_SCHOOL_ID,
    title: "Gas leak emergency dismissal",
    type: "gas_leak",
    status: "active",
    startedAt: NOW,
    createdByUserId: DEMO_APP_USERS.admin,
    description: "Demo scenario for emergency accountability and reunification.",
    demoScenario: true,
  };

  const studentStates: StudentIncidentState[] = students.map((student) => ({
    studentId: student.id,
    schoolId: DEMO_SCHOOL_ID,
    incidentId: DEMO_INCIDENT_ID,
    status: "unaccounted",
    publicParentStatus: "no_update_yet",
    locationVisibility: "admin_only",
    lastUpdatedAt: NOW,
    confidence: "low",
    isLocationAdultVerified: false,
    isStatusAdultVerified: false,
    timeline: [],
  }));

  return {
    school: {
      id: DEMO_SCHOOL_ID,
      name: "General High School",
      activeIncidentId: DEMO_INCIDENT_ID,
      updatedAt: NOW,
    },
    users,
    students,
    classes,
    locations,
    incident,
    studentStates,
  };
}

function parseServiceAccount(): ServiceAccount {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson?.trim()) {
    const parsed = JSON.parse(rawJson) as ServiceAccount & { private_key?: string };
    if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    return parsed;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
    );
  }

  return { projectId, clientEmail, privateKey };
}

async function commitBatch(batch: WriteBatch, pendingWrites: number): Promise<void> {
  if (pendingWrites > 0) await batch.commit();
}

async function seedFirestore(data: SeedData): Promise<void> {
  if (!getApps().length) {
    initializeApp({ credential: cert(parseServiceAccount()) });
  }

  const db = getFirestore();
  let batch = db.batch();
  let pendingWrites = 0;

  const queueSet = (path: string, value: unknown) => {
    batch.set(db.doc(path), value);
    pendingWrites += 1;
    if (pendingWrites >= 450) {
      throw new Error("Seed data exceeded one Firestore batch; add batch chunking.");
    }
  };

  queueSet(`schools/${data.school.id}`, data.school);

  for (const user of data.users) {
    queueSet(`schools/${DEMO_SCHOOL_ID}/users/${user.id}`, user);
  }
  for (const student of data.students) {
    queueSet(`schools/${DEMO_SCHOOL_ID}/students/${student.id}`, student);
  }
  for (const classGroup of data.classes) {
    queueSet(`schools/${DEMO_SCHOOL_ID}/classes/${classGroup.id}`, classGroup);
  }
  for (const location of data.locations) {
    queueSet(`schools/${DEMO_SCHOOL_ID}/locations/${location.id}`, location);
  }

  queueSet(`schools/${DEMO_SCHOOL_ID}/incidents/${DEMO_INCIDENT_ID}`, data.incident);

  for (const state of data.studentStates) {
    queueSet(
      `schools/${DEMO_SCHOOL_ID}/incidents/${DEMO_INCIDENT_ID}/studentStates/${state.studentId}`,
      state,
    );
  }

  await commitBatch(batch, pendingWrites);
  batch = db.batch();
  pendingWrites = 0;
}

async function main() {
  const data = buildSeedData();
  const dryRun = process.argv.includes("--dry-run");

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          schoolId: data.school.id,
          incidentId: data.incident.id,
          users: data.users.length,
          students: data.students.length,
          classes: data.classes.length,
          locations: data.locations.length,
          studentStates: data.studentStates.length,
        },
        null,
        2,
      ),
    );
    return;
  }

  await seedFirestore(data);
  console.log(
    `Seeded ${data.students.length} students, ${data.classes.length} classes, ${data.locations.length} locations, and ${data.studentStates.length} incident states for ${DEMO_SCHOOL_ID}/${DEMO_INCIDENT_ID}.`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Seed failed.";
  console.error(message);
  process.exitCode = 1;
});
