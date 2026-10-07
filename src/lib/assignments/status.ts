import type { Enums } from "@/types/database";

/** An ACTIVE assignment whose expected return time has passed. */
export function isOverdue(
  status: Enums<"assignment_status">,
  expectedReturnAt: string | null,
  now: Date = new Date(),
): boolean {
  return (
    status === "ACTIVE" &&
    expectedReturnAt !== null &&
    new Date(expectedReturnAt).getTime() < now.getTime()
  );
}
