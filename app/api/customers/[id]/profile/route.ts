import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { createAuditLog } from "@/src/lib/audit";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function normalizePhoneForComparison(value: string | null): string | null {
  if (!value) return null;

  let digits = value.replace(/\D/g, "");

  // Treat a 10-digit Indian mobile number and its +91 form as identical.
  if (/^[6-9]\d{9}$/.test(digits)) {
    digits = `91${digits}`;
  }

  return digits || null;
}

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  try {
    const admin = await requireAdmin(request);

    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const rawPhone = String(body.phone ?? "").trim();
    const phone = rawPhone || null;

    if (!name || name.length > 200) {
      return NextResponse.json(
        { error: "Customer name is required and must be 200 characters or less." },
        { status: 400 }
      );
    }

    if (phone && !/^[0-9+\s()-]{7,20}$/.test(phone)) {
      return NextResponse.json(
        { error: "Enter a valid mobile number." },
        { status: 400 }
      );
    }

    const existing = await prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        whatsappDueRemindersOptIn: true,
        whatsappDueRemindersOptInAt: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Customer not found." },
        { status: 404 }
      );
    }

    const phoneChanged =
      normalizePhoneForComparison(existing.phone) !==
      normalizePhoneForComparison(phone);

    const customer = await prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: {
          name,
          phone,
          ...(phoneChanged
            ? {
                whatsappDueRemindersOptIn: false,
                whatsappDueRemindersOptInAt: null,
              }
            : {}),
        },
        select: {
          id: true,
          name: true,
          phone: true,
          createdAt: true,
          updatedAt: true,
          whatsappDueRemindersOptIn: true,
          whatsappDueRemindersOptInAt: true,
        },
      });

      await createAuditLog(
        {
          userId: admin.id,
          action: "UPDATE",
          entityType: "CUSTOMER",
          entityId: id,
          oldValue: {
            name: existing.name,
            phone: existing.phone,
            whatsappDueRemindersOptIn:
              existing.whatsappDueRemindersOptIn,
            whatsappDueRemindersOptInAt:
              existing.whatsappDueRemindersOptInAt,
          },
          newValue: {
            name: updated.name,
            phone: updated.phone,
            whatsappDueRemindersOptIn:
              updated.whatsappDueRemindersOptIn,
            whatsappDueRemindersOptInAt:
              updated.whatsappDueRemindersOptInAt,
          },
        },
        tx
      );

      return updated;
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Customer profile update failed:", error);

    return NextResponse.json(
      { error: "Failed to update customer profile." },
      { status: 500 }
    );
  }
}