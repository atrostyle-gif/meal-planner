export type HouseholdRole = "owner" | "member";

export type Profile = {
  id: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export type Household = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type HouseholdMember = {
  householdId: string;
  userId: string;
  role: HouseholdRole;
  joinedAt: string;
  displayName?: string;
};

export type HouseholdInvite = {
  id: string;
  householdId: string;
  code: string;
  createdBy: string;
  expiresAt: string;
  usedBy: string | null;
  usedAt: string | null;
  createdAt: string;
};

/** 共有データに付与する監査情報 */
export type SharedAudit = {
  createdBy?: string | null;
  updatedBy?: string | null;
  createdByName?: string | null;
  updatedByName?: string | null;
};
