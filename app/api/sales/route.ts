import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { createAuditLog } from "@/src/lib/audit";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: {
        authUserId: session.user.id,
      },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });

    if (!employee || employee.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Active employee access required." },
        { status: 403 }
      );
    }

    const sales = await prisma.sale.findMany({
      select: {
        id: true,
        quantity: true,
        weight: true,
        amount: true,
        saleDate: true,
        status: true,

        customer: {
          select: {
            id: true,
            name: true,
          },
        },

        product: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },

        createdBy: {
          select: {
            name: true,
            username: true,
          },
        },

        voidedBy: {
          select: {
            name: true,
            username: true,
          },
        },

        voidedAt: true,

        payments: {
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            note: true,
          },
          orderBy: {
            paymentDate: "asc",
          },
        },
      },

      orderBy: {
        saleDate: "desc",
      },

      take: 100,
    });

    const formattedSales = sales.map((sale) => {
      const totalPaid = sale.payments.reduce(
        (total, payment) =>
          total + Number(payment.amount),
        0
      );

      const balance = Number(sale.amount) - totalPaid;

      return {
        ...sale,
        weight: Number(sale.weight),
        amount: Number(sale.amount),
        totalPaid,
        balance: Math.max(0, balance),
      };
    });

    return NextResponse.json(formattedSales);
  } catch (error) {
    console.error("Sales lookup failed:", error);

    return NextResponse.json(
      { error: "Failed to load sales." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: {
        authUserId: session.user.id,
      },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });

    if (!employee || employee.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Active employee access required." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const customerName = String(
      body.customerName ?? ""
    ).trim();

    const productId = String(
      body.productId ?? ""
    ).trim();

    const quantity = Number(body.quantity);
    const weight = Number(body.weight);
    const amount = Number(body.amount);
    const initialPayment = Number(
      body.initialPayment ?? 0
    );

    const saleDateValue = String(
      body.saleDate ?? ""
    ).trim();

    if (!customerName) {
      return NextResponse.json(
        { error: "Customer name is required." },
        { status: 400 }
      );
    }

    if (customerName.length > 200) {
      return NextResponse.json(
        {
          error:
            "Customer name must be 200 characters or less.",
        },
        { status: 400 }
      );
    }

    if (!productId) {
      return NextResponse.json(
        { error: "Product is required." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Quantity must be a whole number greater than 0.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(weight) ||
      weight <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Weight must be greater than 0.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Amount must be greater than ₹0.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(initialPayment) ||
      initialPayment < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Initial payment cannot be negative.",
        },
        { status: 400 }
      );
    }

    if (initialPayment > amount) {
      return NextResponse.json(
        {
          error:
            "Initial payment cannot be greater than the sale amount.",
        },
        { status: 400 }
      );
    }

    if (!saleDateValue) {
      return NextResponse.json(
        { error: "Sale date is required." },
        { status: 400 }
      );
    }

    const saleDate = new Date(
      `${saleDateValue}T00:00:00`
    );

    if (Number.isNaN(saleDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid sale date." },
        { status: 400 }
      );
    }

    const runTransaction = async () => {
      return prisma.$transaction(
        async (tx) => {
          const product =
            await tx.product.findUnique({
              where: {
                id: productId,
              },
              select: {
                id: true,
                name: true,
                code: true,
                isActive: true,
                initialStock: true,
              },
            });

          if (!product) {
            throw new Error("PRODUCT_NOT_FOUND");
          }

          if (!product.isActive) {
            throw new Error("PRODUCT_INACTIVE");
          }

          /*
           * Calculate current stock from the immutable
           * inventory ledger.
           */
          const transactions =
            await tx.inventoryTransaction.findMany({
              where: {
                productId,
              },
              select: {
                type: true,
                quantity: true,
              },
            });

          let stock = 0;

          const hasInitialStockTransaction =
            transactions.some(
              (transaction) =>
                transaction.type ===
                "INITIAL_STOCK"
            );

          if (!hasInitialStockTransaction) {
            stock += product.initialStock;
          }

          for (const transaction of transactions) {
            switch (transaction.type) {
              case "INITIAL_STOCK":
              case "PRODUCTION":
              case "STOCK_ADJUSTMENT_ADD":
                stock += transaction.quantity;
                break;

              case "SALE":
              case "STOCK_ADJUSTMENT_REMOVE":
              case "PRODUCTION_REVERSAL":
                stock -= transaction.quantity;
                break;

              case "SALE_VOID":
                stock += transaction.quantity;
                break;

              default:
                break;
            }
          }

          if (quantity > stock) {
            throw new Error("INSUFFICIENT_STOCK");
          }

          /*
           * Find an existing customer by name.
           *
           * Customer names are intentionally the only
           * customer information stored for now.
           */
          let customer =
            await tx.customer.findFirst({
              where: {
                name: customerName,
              },
              select: {
                id: true,
                name: true,
              },
            });

          /*
           * Create the customer if this is a new customer.
           */
          if (!customer) {
            customer =
              await tx.customer.create({
                data: {
                  name: customerName,
                },
                select: {
                  id: true,
                  name: true,
                },
              });

            await createAuditLog(
              {
                userId: employee.id,
                action: "CREATE",
                entityType: "CUSTOMER",
                entityId: customer.id,
                oldValue: null,
                newValue: {
                  name: customer.name,
                },
              },
              tx
            );
          }

          /*
           * Create the sale.
           */
          const sale = await tx.sale.create({
            data: {
              customerId: customer.id,
              productId,
              quantity,
              weight,
              amount,
              saleDate,
              status: "ACTIVE",
              createdById: employee.id,
            },

            select: {
              id: true,
              quantity: true,
              weight: true,
              amount: true,
              saleDate: true,
              status: true,

              customer: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          });

          /*
           * Create the initial customer payment when
           * the customer pays something immediately.
           */
          if (initialPayment > 0) {
            await tx.customerPayment.create({
              data: {
                customerId: customer.id,
                saleId: sale.id,
                amount: initialPayment,
                paymentDate: saleDate,
                createdById: employee.id,
                note: "Initial payment at sale",
              },
            });
          }

          /*
           * Record the inventory movement.
           */
          await tx.inventoryTransaction.create({
            data: {
              productId,
              type: "SALE",
              quantity,
              referenceType: "SALE",
              referenceId: sale.id,
              createdById: employee.id,
              saleId: sale.id,
            },
          });

          /*
           * Audit the sale creation.
           */
          await createAuditLog(
            {
              userId: employee.id,
              action: "CREATE",
              entityType: "SALE",
              entityId: sale.id,
              oldValue: null,
              newValue: {
                customerId: customer.id,
                customerName: customer.name,
                productId,
                quantity,
                weight,
                amount,
                initialPayment,
                balance:
                  amount - initialPayment,
                saleDate,
                status: "ACTIVE",
              },
            },
            tx
          );

          /*
           * Audit the initial payment.
           */
          if (initialPayment > 0) {
            const payment =
              await tx.customerPayment.findFirst({
                where: {
                  saleId: sale.id,
                  amount: initialPayment,
                },
                orderBy: {
                  createdAt: "desc",
                },
                select: {
                  id: true,
                },
              });

            if (payment) {
              await createAuditLog(
                {
                  userId: employee.id,
                  action: "CREATE",
                  entityType: "CUSTOMER_PAYMENT",
                  entityId: payment.id,
                  oldValue: null,
                  newValue: {
                    customerId: customer.id,
                    saleId: sale.id,
                    amount: initialPayment,
                    paymentDate: saleDate,
                  },
                },
                tx
              );
            }
          }

          return {
            ...sale,
            weight: Number(sale.weight),
            amount: Number(sale.amount),
            initialPayment,
            balance:
              Number(sale.amount) -
              initialPayment,
          };
        },
        {
          isolationLevel: "Serializable",
        }
      );
    };

    /*
     * Serializable transactions can occasionally conflict
     * when two sales happen at exactly the same time.
     * Retry those conflicts a few times.
     */
    let sale;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        sale = await runTransaction();
        break;
      } catch (error) {
        const isSerializationConflict =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2034";

        if (
          !isSerializationConflict ||
          attempt === 3
        ) {
          throw error;
        }
      }
    }

    return NextResponse.json(
      {
        message: "Sale created successfully.",
        sale,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PRODUCT_NOT_FOUND") {
        return NextResponse.json(
          { error: "Product not found." },
          { status: 404 }
        );
      }

      if (error.message === "PRODUCT_INACTIVE") {
        return NextResponse.json(
          {
            error:
              "This product is inactive and cannot be sold.",
          },
          { status: 409 }
        );
      }

      if (
        error.message === "INSUFFICIENT_STOCK"
      ) {
        return NextResponse.json(
          {
            error:
              "Insufficient stock for this sale.",
          },
          { status: 409 }
        );
      }
    }

    console.error("Sale creation failed:", error);

    return NextResponse.json(
      { error: "Failed to create sale." },
      { status: 500 }
    );
  }
}