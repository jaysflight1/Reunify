import type {
  ParentSafeStudentStatus,
  Student,
  StudentIncidentState,
} from "@/types/incident";

function studentName(student: Student | undefined, state: StudentIncidentState): string {
  return student?.fullName ?? state.studentId;
}

export function parentSafeMessage(state: StudentIncidentState): string {
  switch (state.publicParentStatus) {
    case "safe":
      return "Your child has been marked safe with school staff.";
    case "being_verified":
      return "Your child's status is being actively verified by school staff.";
    case "needs_assistance":
      return "Your child is receiving assistance from school staff.";
    case "pickup_ready":
      return "Your child is ready for pickup. Follow the school's pickup instructions.";
    case "picked_up":
      return "Your child has been marked picked up.";
    case "no_update_yet":
      return "No verified update is available yet. School staff are continuing accountability checks.";
  }
}

export function pickupInstructions(state: StudentIncidentState): string | undefined {
  if (state.publicParentStatus === "pickup_ready") {
    return "Proceed only to the assigned pickup area at your assigned time.";
  }
  if (state.publicParentStatus === "picked_up") {
    return "No further pickup action is needed.";
  }
  return "Pickup is not available yet. Please wait for school instructions.";
}

export function toParentSafeStatus(
  state: StudentIncidentState,
  student?: Student,
): ParentSafeStudentStatus {
  const locationSuffix =
    state.locationVisibility === "parent_safe" && state.locationLabel
      ? ` Last verified area: ${state.locationLabel}.`
      : "";

  return {
    studentId: state.studentId,
    studentName: studentName(student, state),
    publicParentStatus: state.publicParentStatus,
    lastUpdatedAt: state.lastUpdatedAt,
    parentSafeMessage: `${parentSafeMessage(state)}${locationSuffix}`,
    pickupInstructions: pickupInstructions(state),
  };
}
