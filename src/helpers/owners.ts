import { Member } from "../db/interfaces";

export const SHARED_OWNER_ID = 0;

export function ownerLabel(memberId: number | null | undefined, members: Member[]): string {
  if (!memberId) return "Wspólny";
  return members.find((member) => member.id === memberId)?.name ?? "Wspólny";
}
