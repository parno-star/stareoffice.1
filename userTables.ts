import type { TableNames } from "../_generated/dataModel.d.ts";

/**
 * Every table that stores per-user records keyed by a `by_user` index on a
 * `userId` field.
 *
 * When a super admin permanently deletes a single user (for example an account
 * left orphaned after its organization was removed), we cascade-purge all of
 * that person's personal records across these tables — then delete the user row
 * itself — so the database stays clean and every count stays accurate. The
 * purge runs in safe background batches (see userPurge.ts) so it never exceeds a
 * single transaction's limits.
 *
 * `satisfies readonly TableNames[]` guarantees each entry is a real table name;
 * the build fails if a table is renamed or removed.
 */
export const USER_SCOPED_TABLES = [
  "trackCalculations",
  "profileChangeRequests",
  "historyChangeRequests",
  "leaveRequests",
  "leaveBalances",
  "eventRsvps",
  "employeeDocuments",
  "roomBookings",
  "attendanceRecords",
  "notifications",
  "notificationPreferences",
  "expenseReports",
  "cashAdvances",
  "onboardingEmployees",
  "onboardingTasks",
  "onboardingCheckins",
  "courseQuizAttempts",
  "courseCertificates",
  "courseReviews",
  "courseEnrollments",
  "assetAssignments",
  "policyAcknowledgments",
  "teamMembers",
  "dottedLineReports",
  "employeeSkills",
  "trainingSessionRegistrations",
  "learnerStats",
  "externalTrainings",
  "courseBookmarks",
  "talentPlacements",
  "talentIdps",
  "talentIdpItems",
  "nineBoxAssessments",
  "kpiMeasurements",
  "microlessonCompletions",
  "flashcardReviews",
  "mentorProfiles",
  "peerGroupMembers",
  "trainingOutcomes",
  "careerAssignments",
  "competencyAssessments",
  "employeeSalaryComponents",
  "payslips",
  "okrCheckins",
  "engagementResponses",
  "wellnessCheckins",
  "aiChatSessions",
  "aiChatMessages",
  "travelRequests",
  "ggsEvaluators",
  "ggsEmployeeAssignments",
  "pulseResponses",
  "resignationRequests",
  "offboardingCases",
  "offboardingTasks",
  "offboardingHandovers",
  "exitInterviews",
  "employeeEducation",
  "employeeTrainingHistory",
  "employeeOrganizationHistory",
  "employeePositionHistory",
  "employeeAwardHistory",
  "careerPathAssignments",
  "roleRequests",
  "letterReads",
  "letterRecipients",
  "letterSignatures",
  "tourProgress",
] as const satisfies readonly TableNames[];

export type UserScopedTable = (typeof USER_SCOPED_TABLES)[number];
