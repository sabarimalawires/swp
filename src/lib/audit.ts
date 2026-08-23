import { prisma } from "@/src/lib/prisma";
import type { Prisma } from "@/src/generated/prisma/client";

type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DEACTIVATE"
  | "REACTIVATE"
  | "APPROVE"
  | "REJECT"
  | "VOID"
  | "LOGIN"
  | "LOGOUT"
  | "PASSWORD_CHANGE"
  | "PASSWORD_RESET";

type AuditEntityType =
  | "USER"
  | "PRODUCT"
  | "WORK_ENTRY"
  | "SALE"
  | "INVENTORY";

type AuditClient =
  | Prisma.TransactionClient
  | typeof prisma;

type CreateAuditLogInput = {
  userId?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
};

export async function createAuditLog(
  input: CreateAuditLogInput,
  client: AuditClient = prisma
) {
  return client.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValue:
        input.oldValue === undefined
          ? undefined
          : JSON.parse(
              JSON.stringify(input.oldValue)
            ),
      newValue:
        input.newValue === undefined
          ? undefined
          : JSON.parse(
              JSON.stringify(input.newValue)
            ),
    },
  });
}