
import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { createAuditLog } from "@/src/lib/audit";

type SaleLineInput = {
  productId: string;
  quantity: number;
  weight: number;
  rate: number;
};

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getCurrentStock(
  initialStockKg: number,
  transactions: { type: string; weight: number }[],
) {
  let stockKg = 0;

  // Use opening stock only if no explicit initial-stock transaction exists.
  if (!transactions.some((t) => t.type === "INITIAL_STOCK")) {
    stockKg += initialStockKg;
  }

  for (const transaction of transactions) {
    switch (transaction.type) {
      case "INITIAL_STOCK":
      case "PRODUCTION":
      case "STOCK_ADJUSTMENT_ADD":
      case "SALE_VOID":
        stockKg += transaction.weight;
        break;

      case "SALE":
      case "STOCK_ADJUSTMENT_REMOVE":
      case "PRODUCTION_REVERSAL":
        stockKg -= transaction.weight;
        break;
    }
  }

  return stockKg;
}

export async function GET(request: Request) {
  try {
    const employee = await requireAdmin(request);

    if (!employee) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );
    }

    const sales = await prisma.sale.findMany({
      include: {
        customer: true,
        product: true,
        items: {
          orderBy: { productName: "asc" },
          select: {
            id: true,
            productId: true,
            productName: true,
            quantity: true,
            weight: true,
            rate: true,
            amount: true,
            deductedQuantity: true,
            deductedWeight: true,
          },
        },
        createdBy: {
          select: { name: true, username: true },
        },
        voidedBy: {
          select: { name: true, username: true },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            note: true,
          },
          orderBy: { paymentDate: "asc" },
        },
      },
      orderBy: { saleDate: "desc" },
      take: 100,
    });

    return NextResponse.json(
      sales.map((sale) => {
        const totalPaid = sale.payments.reduce(
          (total, payment) => total + Number(payment.amount),
          0,
        );

        return {
          ...sale,
          quantity: Number(sale.quantity),
          weight: Number(sale.weight),
          amount: Number(sale.amount),
          items: sale.items.map((item) => ({
            ...item,
            weight: Number(item.weight),
            rate: Number(item.rate),
            amount: Number(item.amount),
            deductedWeight: Number(item.deductedWeight ?? 0),
          })),
          totalPaid,
          balance: Math.max(0, Number(sale.amount) - totalPaid),
        };
      }),
    );
  } catch (error) {
    console.error("Sales lookup failed:", error);
    return NextResponse.json(
      { error: "Failed to load sales." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const employee = await requireAdmin(request);

    if (!employee) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );
    }

    const body = await request.json();

    const customerName = String(body.customerName ?? "").trim();
    const customerId = String(body.customerId ?? "").trim();
    const customerPhone = String(body.customerPhone ?? "").trim();
    const saleDateValue = String(body.saleDate ?? "").trim();
    const initialPayment = Number(body.initialPayment ?? 0);
    const confirmInsufficientStock =
      body.confirmInsufficientStock === true;

    if (!customerName && !customerId) {
      return NextResponse.json(
        { error: "Select a customer." },
        { status: 400 },
      );
    }

    if (customerName.length > 200) {
      return NextResponse.json(
        { error: "Customer name must be 200 characters or less." },
        { status: 400 },
      );
    }

    if (
      customerPhone &&
      !/^[0-9+\-\s()]{7,20}$/.test(customerPhone)
    ) {
      return NextResponse.json(
        { error: "Enter a valid mobile number." },
        { status: 400 },
      );
    }

    if (!saleDateValue) {
      return NextResponse.json(
        { error: "Sale date is required." },
        { status: 400 },
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(saleDateValue)) {
      return NextResponse.json(
        { error: "Invalid sale date." },
        { status: 400 },
      );
    }

    const saleDate = new Date(`${saleDateValue}T00:00:00.000Z`);

    if (
      Number.isNaN(saleDate.getTime()) ||
      saleDate.toISOString().slice(0, 10) !== saleDateValue
    ) {
      return NextResponse.json(
        { error: "Invalid sale date." },
        { status: 400 },
      );
    }

    if (!Number.isFinite(initialPayment) || initialPayment < 0) {
      return NextResponse.json(
        { error: "Initial payment cannot be negative." },
        { status: 400 },
      );
    }

    const rawItems: unknown[] = Array.isArray(body.items)
      ? body.items
      : [
          {
            productId: body.productId,
            quantity: body.quantity,
            weight: body.weight,
            rate:
              body.rate !== undefined
                ? body.rate
                : Number(body.weight) > 0
                  ? Number(body.amount) / Number(body.weight)
                  : 0,
          },
        ];

    if (rawItems.length === 0) {
      return NextResponse.json(
        { error: "Add at least one product." },
        { status: 400 },
      );
    }

    const items: SaleLineInput[] = [];

    for (const raw of rawItems) {
      if (!raw || typeof raw !== "object") {
        return NextResponse.json(
          { error: "Invalid product line." },
          { status: 400 },
        );
      }

      const line = raw as Record<string, unknown>;
      const productId = String(line.productId ?? "").trim();
      const quantity = Number(line.quantity);
      const weight = Number(line.weight);
      const rate = Number(line.rate);

      if (
        !productId ||
        !Number.isInteger(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(weight) ||
        weight <= 0 ||
        Math.abs(weight * 100 - Math.round(weight * 100)) > 1e-7 ||
        !Number.isFinite(rate) ||
        rate <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "Each product needs a valid product, whole quantity, positive weight (up to 2 decimals), and positive rate.",
          },
          { status: 400 },
        );
      }

      items.push({ productId, quantity, weight, rate });
    }

    if (
      new Set(items.map((item) => item.productId)).size !== items.length
    ) {
      return NextResponse.json(
        { error: "A product can only be selected once per sale." },
        { status: 400 },
      );
    }

    const lineAmounts = items.map((item) =>
      money(item.weight * item.rate),
    );

    const totalAmount = money(
      lineAmounts.reduce((sum, amount) => sum + amount, 0),
    );

    if (initialPayment > totalAmount) {
      return NextResponse.json(
        { error: "Initial payment cannot exceed the sale total." },
        { status: 400 },
      );
    }

    const runTransaction = () =>
      prisma.$transaction(
        async (tx) => {
          const customer = customerId
            ? await tx.customer.findUnique({
                where: { id: customerId },
                select: { id: true, name: true },
              })
            : await tx.customer.findFirst({
                where: { name: customerName },
                select: { id: true, name: true },
              });

          if (customerId && !customer) {
            throw new Error("CUSTOMER_NOT_FOUND");
          }

          let resolvedCustomer = customer;

          if (!resolvedCustomer) {
            resolvedCustomer = await tx.customer.create({
              data: {
                name: customerName,
                phone: customerPhone || null,
              },
              select: {
                id: true,
                name: true,
                phone: true,
              },
            });

            await createAuditLog(
              {
                userId: employee.id,
                action: "CREATE",
                entityType: "CUSTOMER",
                entityId: resolvedCustomer.id,
                oldValue: null,
                newValue: { name: resolvedCustomer.name },
              },
              tx,
            );
          }

          const shortages: {
            productId: string;
            productName: string;
            requested: number;
            available: number;
          }[] = [];

          const preparedItems: {
            productId: string;
            productName: string;
            quantity: number;
            weight: number;
            rate: number;
            amount: number;
            deductedWeight: number;
          }[] = [];

          for (let index = 0; index < items.length; index++) {
            const item = items[index];

            const product = await tx.product.findUnique({
              where: { id: item.productId },
              select: {
                id: true,
                name: true,
                isActive: true,
                initialStockKg: true,
              },
            });

            if (!product) throw new Error("PRODUCT_NOT_FOUND");
            if (!product.isActive) throw new Error("PRODUCT_INACTIVE");

            const transactions = await tx.inventoryTransaction.findMany({
              where: { productId: product.id },
              select: { type: true, weight: true },
            });

            const available = getCurrentStock(
              Number(product.initialStockKg),
              transactions.map((t) => ({
                type: t.type,
                weight: Number(t.weight),
              })),
            );

            if (item.weight > available) {
              shortages.push({
                productId: product.id,
                productName: product.name,
                requested: item.weight,
                available,
              });
            }

            preparedItems.push({
              productId: product.id,
              productName: product.name,
              quantity: item.quantity,
              weight: item.weight,
              rate: item.rate,
              amount: lineAmounts[index],
              deductedWeight: item.weight,
            });
          }

          if (shortages.length > 0 && !confirmInsufficientStock) {
            throw new Error(
              `INSUFFICIENT_STOCK:${JSON.stringify(shortages)}`,
            );
          }

          const totalQuantity = preparedItems.reduce(
            (sum, item) => sum + item.quantity,
            0,
          );

          const totalWeight = preparedItems.reduce(
            (sum, item) => sum + item.weight,
            0,
          );

          const sale = await tx.sale.create({
            data: {
              customerId: resolvedCustomer.id,
              productId: preparedItems[0].productId,
              quantity: totalQuantity,
              weight: totalWeight,
              amount: totalAmount,
              saleDate,
              status: "ACTIVE",
              createdById: employee.id,
              items: {
                create: preparedItems.map((item) => ({
                  productId: item.productId,
                  productName: item.productName,
                  quantity: item.quantity,
                  weight: item.weight,
                  rate: item.rate,
                  amount: item.amount,
                  deductedWeight: item.deductedWeight,
                })),
              },
            },
            include: {
              items: true,
              customer: { select: { id: true, name: true } },
            },
          });

          for (const item of preparedItems) {
            if (item.deductedWeight > 0) {
              await tx.inventoryTransaction.create({
                data: {
                  productId: item.productId,
                  type: "SALE",
                  quantity: 0,
                  weight: item.deductedWeight,
                  referenceType: "SALE",
                  referenceId: sale.id,
                  createdById: employee.id,
                  saleId: sale.id,
                },
              });
            }
          }

          if (initialPayment > 0) {
            const payment = await tx.customerPayment.create({
              data: {
                customerId: resolvedCustomer.id,
                amount: initialPayment,
                paymentDate: saleDate,
                createdById: employee.id,
                note: "Initial payment at sale",
              },
            });

            await createAuditLog(
              {
                userId: employee.id,
                action: "CREATE",
                entityType: "CUSTOMER_PAYMENT",
                entityId: payment.id,
                oldValue: null,
                newValue: {
                  customerId: resolvedCustomer.id,
                  amount: initialPayment,
                  paymentDate: saleDate,
                  note: payment.note,
                },
              },
              tx,
            );
          }

          await createAuditLog(
            {
              userId: employee.id,
              action: "CREATE",
              entityType: "SALE",
              entityId: sale.id,
              oldValue: null,
              newValue: {
                customerId: resolvedCustomer.id,
                customerName: resolvedCustomer.name,
                items: preparedItems,
                totalAmount,
                initialPayment,
                saleDate,
                status: "ACTIVE",
              },
            },
            tx,
          );

          return {
            ...sale,
            weight: Number(sale.weight),
            amount: Number(sale.amount),
            items: sale.items.map((item) => ({
              ...item,
              weight: Number(item.weight),
              rate: Number(item.rate),
              amount: Number(item.amount),
              deductedWeight: Number(item.deductedWeight ?? 0),
            })),
            initialPayment,
            balance: money(totalAmount - initialPayment),
          };
        },
        { isolationLevel: "Serializable" },
      );

    let sale;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        sale = await runTransaction();
        break;
      } catch (error) {
        const isConflict =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2034";

        if (isConflict && attempt < 3) continue;
        throw error;
      }
    }

    return NextResponse.json(
      { message: "Sale created successfully.", sale },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith("INSUFFICIENT_STOCK:")) {
        const shortages = JSON.parse(
          error.message.slice("INSUFFICIENT_STOCK:".length),
        );

        return NextResponse.json(
          {
            error: "Some products have insufficient stock.",
            requiresConfirmation: true,
            shortages,
          },
          { status: 409 },
        );
      }

      if (error.message === "CUSTOMER_NOT_FOUND") {
        return NextResponse.json(
          { error: "Customer not found." },
          { status: 404 },
        );
      }

      if (error.message === "PRODUCT_NOT_FOUND") {
        return NextResponse.json(
          { error: "One or more products were not found." },
          { status: 404 },
        );
      }

      if (error.message === "PRODUCT_INACTIVE") {
        return NextResponse.json(
          { error: "Inactive products cannot be sold." },
          { status: 409 },
        );
      }
    }

    console.error("Sale creation failed:", error);

    return NextResponse.json(
      { error: "Failed to create sale." },
      { status: 500 },
    );
  }
}
