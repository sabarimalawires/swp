"use client";

import { useEffect, useMemo, useState } from "react";

import { authClient } from "@/src/lib/auth-client";

import DownloadSaleEstimatePdf from "@/src/components/reports/DownloadSaleEstimatePdf";

import { useRouter } from "next/navigation";

import Sidebar from "@/src/components/Sidebar";

type Product = {

  id: string;

  name: string;

  code: string | null;

  stock: number;

  lowStockThreshold: number;

  isLowStock: boolean;

};

type Customer = {

  id: string;

  name: string;

  phone: string | null;

  totalPurchases?: number;

  totalPaid?: number;

  pendingBalance?: number;

};

type SalesUnit = "KGS" | "SQ_FT" | "R_FT" | "R_MTR";



type SaleLine = {

  productId: string;

  quantity: string;

  salesUnit: SalesUnit;

  salesMeasurement: string;

  inventoryDeductionKg: string;

  rate: string;

};

type SaleItem = {

  id?: string;

  productId: string;

  productName: string;

  quantity: number;

  weight: number;

  rate: number;

  amount: number;

  deductedQuantity?: number;

  deductedWeight?: number;

  salesMeasurement: number;

salesUnit: "KGS" | "SQ_FT" | "R_FT" | "R_MTR";

};

type Sale = {

  id: string;

  quantity: number;

  weight: number;

  amount: number;

  totalPaid: number;

  balance: number;

  saleDate: string;

  status: "ACTIVE" | "VOIDED";

  customer: { id: string; name: string };

  product: { id: string; name: string };

  items?: SaleItem[];

  createdBy: { name: string; username: string };

  payments?: {

    id: string;

    amount: number;

    paymentDate: string;

    note?: string | null;

  }[];

};

const inputClass =

  "mt-1 h-11 w-full rounded-xl border border-[#e8d4c5] bg-white px-3 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-2 focus:ring-[#fce3d0]";

const money = (value: number) =>

  Number(value || 0).toFixed(2);

export default function SalesPage() {

  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [userName, setUserName] = useState("");

  const [products, setProducts] = useState<Product[]>([]);

  const [customers, setCustomers] = useState<Customer[]>([]);

  const [sales, setSales] = useState<Sale[]>([]);

  const [customerSearch, setCustomerSearch] = useState("");

  const [showCustomerList, setShowCustomerList] = useState(false);

  const [customerId, setCustomerId] = useState("");

  const [newCustomer, setNewCustomer] = useState(false);

  const [newCustomerName, setNewCustomerName] = useState("");

  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const [productSearch, setProductSearch] = useState("");

  const [showProductList, setShowProductList] = useState(false);

  const [items, setItems] = useState<SaleLine[]>([]);

  const [saleDate, setSaleDate] = useState("");

  const [saving, setSaving] = useState(false);

  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [stockConfirmation, setStockConfirmation] = useState<{

    shortages: { productId: string; productName?: string; requested?: number; available?: number; [key: string]: unknown }[];

  } | null>(null);

  const loadData = async () => {

    const [inventoryResponse, salesResponse, customersResponse] =

      await Promise.all([

        fetch("/api/inventory"),

        fetch("/api/sales"),

        fetch("/api/customers"),

      ]);

    const [inventoryResult, salesResult, customersResult] =

      await Promise.all([

        inventoryResponse.json(),

        salesResponse.json(),

        customersResponse.json(),

      ]);

    if (!inventoryResponse.ok) {

      throw new Error(inventoryResult.error || "Failed to load inventory.");

    }

    if (!salesResponse.ok) {

      throw new Error(salesResult.error || "Failed to load sales.");

    }

    if (!customersResponse.ok) {

      throw new Error(customersResult.error || "Failed to load customers.");

    }

    setProducts(

      (Array.isArray(inventoryResult) ? inventoryResult : [])

        .sort((a: Product, b: Product) =>

          a.name.localeCompare(b.name)

        )

    );

    setSales(Array.isArray(salesResult) ? salesResult : []);

    setCustomers(

      (Array.isArray(customersResult) ? customersResult : [])

        .sort((a: Customer, b: Customer) =>

          a.name.localeCompare(b.name)

        )

    );

  };

  useEffect(() => {

    const initialize = async () => {

      try {

        const { data } = await authClient.getSession();

        if (!data?.user) {

          router.replace("/");

          return;

        }

        setUserName(data.user.name);

        const employeeResponse = await fetch("/api/me/employee");

        if (!employeeResponse.ok) {

          router.replace("/dashboard");

          return;

        }

        const employee = await employeeResponse.json();

        if (employee.role !== "ADMIN") {

          router.replace("/dashboard");

          return;

        }

        await loadData();

        // Use local calendar date rather than UTC date.

        const today = new Date();

        const localDate = [

          today.getFullYear(),

          String(today.getMonth() + 1).padStart(2, "0"),

          String(today.getDate()).padStart(2, "0"),

        ].join("-");

        setSaleDate(localDate);

      } catch (err) {

        console.error(err);

        setError(

          err instanceof Error ? err.message : "Failed to load sales data."

        );

      } finally {

        setLoading(false);

      }

    };

    initialize();

  }, [router]);

  const sortedProducts = useMemo(

    () => [...products].sort((a, b) => a.name.localeCompare(b.name)),

    [products]

  );



const filteredCustomers = useMemo(() => {

  const query = customerSearch.trim().toLowerCase();



  return customers.filter(

    (customer) =>

      customer.name.toLowerCase().includes(query) ||

      (customer.phone ?? "").toLowerCase().includes(query)

  );

}, [customers, customerSearch]);



  const filteredProducts = useMemo(() => {

    const query = productSearch.trim().toLowerCase();

    return sortedProducts.filter((product) => {

      const alreadySelected = items.some(

        (item) => item.productId === product.id

      );

      const matches =

        product.name.toLowerCase().includes(query) ||

        (product.code || "").toLowerCase().includes(query);

      return !alreadySelected && matches;

    });

  }, [sortedProducts, items, productSearch]);

  const selectedCustomer = customers.find(

    (customer) => customer.id === customerId

  );

  const unitLabels: Record<SalesUnit, string> = {

  KGS: "kg",

  SQ_FT: "Sq.ft",

  R_FT: "R.ft",

  R_MTR: "R.m",

};



const lineAmounts = items.map((item) => {

  const measurement = Number(item.salesMeasurement);

  const rate = Number(item.rate);



  if (

    !item.salesMeasurement.trim() ||

    !item.rate.trim() ||

    !Number.isFinite(measurement) ||

    !Number.isFinite(rate)

  ) {

    return 0;

  }



  return Math.round(measurement * rate * 100) / 100;

});

  const totalAmount = Math.round(

    lineAmounts.reduce((sum, amount) => sum + amount, 0) * 100

  ) / 100;

  const updateItem = (

    index: number,

    field: keyof SaleLine,

    value: string

  ) => {

    setItems((previous) =>

      previous.map((item, i) =>

        i === index ? { ...item, [field]: value } : item

      )

    );

  };

  const addProduct = (product: Product) => {

  setItems((previous) => [

    ...previous,

    {

      productId: product.id,

      quantity: "1",

      salesUnit: "KGS",

      salesMeasurement: "",

      inventoryDeductionKg: "",

      rate: "",

    },

  ]);



  setProductSearch("");

  setShowProductList(false);

};

  const removeProduct = (index: number) => {

    setItems((previous) => previous.filter((_, i) => i !== index));

  };

  const resetForm = () => {

    setEditingSaleId(null);

    setCustomerId("");

    setCustomerSearch("");

    setNewCustomer(false);

    setNewCustomerName("");

    setNewCustomerPhone("");

    setItems([]);

    setProductSearch("");

    setStockConfirmation(null);

  };

  const handleCreateSale = async (

    event: React.FormEvent<HTMLFormElement>,

    confirmInsufficientStock = false

  ) => {

    event.preventDefault();

    setError("");

    setSuccess("");

    if (!newCustomer && !customerId) {

      setError("Please select a customer or add a new customer.");

      return;

    }

    if (newCustomer && !newCustomerName.trim()) {

      setError("Customer name is required.");

      return;

    }

if (

  newCustomer &&

  newCustomerPhone.trim() &&

  !/^[0-9+\-\s()]{7,20}$/.test(

    newCustomerPhone.trim()

  )

) {

  setError("Enter a valid mobile number.");

  return;

}



    if (!saleDate) {

      setError("Sale date is required.");

      return;

    }

    if (items.length === 0 || items.some((item) => !item.productId)) {

      setError("Please select at least one product.");

      return;

    }

    for (let i = 0; i < items.length; i++) {

  const item = items[i];

  const quantity = Number(item.quantity);

  const measurement = Number(item.salesMeasurement);

  const rate = Number(item.rate);



  if (!Number.isInteger(quantity) || quantity <= 0) {

    setError(`Product ${i + 1}: quantity must be a positive whole number.`);

    return;

  }



  if (

    !item.salesMeasurement.trim() ||

    !Number.isFinite(measurement) ||

    measurement <= 0 ||

    !/^\d+(\.\d{1,3})?$/.test(item.salesMeasurement)

  ) {

    setError(`Product ${i + 1}: sales measurement must be positive with at most 3 decimal places.`);

    return;

  }



  if (

    !item.rate.trim() ||

    !Number.isFinite(rate) ||

    rate <= 0 ||

    !/^\d+(\.\d{1,2})?$/.test(item.rate)

  ) {

    setError(`Product ${i + 1}: rate must be positive with at most 2 decimal places.`);

    return;

  }



  if (

    item.salesUnit !== "KGS" &&

    (

      !item.inventoryDeductionKg.trim() ||

      !Number.isFinite(Number(item.inventoryDeductionKg)) ||

      Number(item.inventoryDeductionKg) <= 0 ||

      !/^\d+(\.\d{1,3})?$/.test(item.inventoryDeductionKg)

    )

  ) {

    setError(`Product ${i + 1}: enter a valid inventory deduction in KGs.`);

    return;

  }

}

    setSaving(true);

    setStockConfirmation(null);

    try {

const response = await fetch(

  editingSaleId ? `/api/sales/${editingSaleId}` : "/api/sales",

  {

    method: editingSaleId ? "PATCH" : "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify({

      ...(newCustomer && !editingSaleId

        ? { customerName: newCustomerName.trim(),

      customerPhone: newCustomerPhone.trim(),

 }

        : { customerId }),

      saleDate,

      items: items.map((item) => ({

  productId: item.productId,

  quantity: Number(item.quantity),

  salesMeasurement: Number(item.salesMeasurement),

  salesUnit: item.salesUnit,

  inventoryDeductionKg:

    item.salesUnit === "KGS"

      ? Number(item.salesMeasurement)

      : Number(item.inventoryDeductionKg),

  rate: Number(item.rate),

})),

      confirmInsufficientStock,

    }),

  }

);

      const result = await response.json();



     if (

  response.status === 409 &&

  result.requiresConfirmation &&

  Array.isArray(result.shortages)

) {

  console.log("CONFIRMATION CONDITION MATCHED");

  setStockConfirmation({ shortages: result.shortages });

  setError("");

  return;

}

      if (!response.ok) {

        throw new Error(result.error || (editingSaleId ? "Failed to update sale." : "Failed to create sale."));

      }

     setSuccess(

  `${editingSaleId ? "Sale updated" : "Sale created"} successfully.`

);

      resetForm();

      await loadData();

    } catch (err) {

      setError(err instanceof Error ? err.message : (editingSaleId ? "Failed to update sale." : "Failed to create sale."));

    } finally {

      setSaving(false);

    }

  };

const handleEditSale = (sale: Sale) => {

  if (sale.status !== "ACTIVE") {

    setError("Voided sales cannot be edited.");

    return;

  }

  if (!sale.items?.length) {

    setError("This sale has no saved item details and cannot be edited.");

    return;

  }

  setError("");

  setSuccess("");

  setStockConfirmation(null);

  setEditingSaleId(sale.id);

  setCustomerId(sale.customer.id);

  setCustomerSearch(sale.customer.name);

  setNewCustomer(false);

  setNewCustomerName("");

  const date = new Date(sale.saleDate);

  const localDate = [

    date.getUTCFullYear(),

    String(date.getUTCMonth() + 1).padStart(2, "0"),

    String(date.getUTCDate()).padStart(2, "0"),

  ].join("-");

  setSaleDate(localDate);

  setItems(

  sale.items.map((item) => ({

    productId: item.productId,

    quantity: String(item.quantity),

    salesUnit: item.salesUnit ?? "KGS",

    salesMeasurement: String(

      item.salesMeasurement ?? item.weight,

    ),

    inventoryDeductionKg: String(

      item.deductedWeight ?? item.weight,

    ),

    rate: String(item.rate),

  })),

);

  setProductSearch("");

  setShowProductList(false);

  window.scrollTo({ top: 0, behavior: "smooth" });

};



const handleDeleteSale = async (saleId: string) => {

  if (

    !window.confirm(

      "Are you sure you want to permanently delete this sale from sales history? This action cannot be undone."

    )

  ) {

    return;

  }



  setError("");

  setSuccess("");

  setSaving(true);



  try {

    const response = await fetch(`/api/sales/${saleId}`, {

      method: "DELETE",

    });



    const result = await response.json();



    if (!response.ok) {

      throw new Error(result.error || "Failed to delete sale.");

    }



    setSuccess("Sale deleted successfully.");

    await loadData();

  } catch (err) {

    setError(

      err instanceof Error ? err.message : "Failed to delete sale."

    );

  } finally {

    setSaving(false);

  }

};



  if (loading) {

    return (

      <main className="flex min-h-screen items-center justify-center bg-[#fff8f2]">

        <p className="text-[#5b2f1f]">Loading sales...</p>

      </main>

    );

  }

  return (

    <div className="flex min-h-screen bg-[#fff8f2]">

      <Sidebar />

      <main className="min-w-0 flex-1 p-4 sm:p-8">

        <div className="mx-auto max-w-7xl">

          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

            <div>

              <p className="text-sm text-[#a66a4a]">

                SWP Business Management System

              </p>

              <h1 className="mt-2 text-3xl font-bold text-[#3b2117]">

                Sales

              </h1>

              <p className="mt-2 text-[#7b5a49]">

                Create multi-product sales and review sale history.

              </p>

            </div>

            <div className="rounded-xl bg-[#fff1e6] px-4 py-3">

              <p className="text-xs text-[#a66a4a]">Signed in as</p>

              <p className="font-semibold text-[#3b2117]">{userName}</p>

            </div>

          </header>

          {success && (

            <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">

              {success}

            </div>

          )}

          {error && (

            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">

              {error}

            </div>

          )}

          <div className="mt-8 grid items-start gap-6 xl:grid-cols-[460px_minmax(0,1fr)]">

            <section className="rounded-2xl border border-[#f1dfd2] bg-white p-5 shadow-sm sm:p-6">

              <h2 className="text-lg font-semibold text-[#3b2117]">

                {editingSaleId ? "Edit Sale" : "Create Sale"}

              </h2>

              <p className="mt-1 text-sm text-[#7b5a49]">

                Add one or more products to the same sale.

              </p>

              <form

                onSubmit={(event) => handleCreateSale(event)}

                className="mt-6 space-y-5"

              >

                <div>

                  <label className="block text-sm font-semibold text-[#5b3928]">

                    Customer

                  </label>

{!newCustomer ? (

  <>

    <div className="relative mt-1">

      <input

        value={customerSearch}

        onFocus={() => setShowCustomerList(true)}

        onChange={(event) => {

          setCustomerSearch(event.target.value);

          setCustomerId("");

          setShowCustomerList(true);

        }}

        placeholder="Search or select a customer..."

        className={inputClass}

        autoComplete="off"

        required={!customerId}

      />

      {showCustomerList && (

        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-[#e8d4c5] bg-white shadow-lg">

          {filteredCustomers.length === 0 ? (

            <p className="p-3 text-sm text-[#7b5a49]">

              No matching customers found.

            </p>

          ) : (

            filteredCustomers.map((customer) => (

              <button

                key={customer.id}

                type="button"

                onClick={() => {

                  setCustomerId(customer.id);

                  setCustomerSearch(customer.name);

                  setShowCustomerList(false);

                }}

                className={`block w-full border-b border-[#f5e9e0] px-3 py-3 text-left text-sm last:border-b-0 hover:bg-[#fff7ed] ${

                  customerId === customer.id

                    ? "bg-[#fff1e6] font-semibold"

                    : ""

                }`}

              >

                {customer.name}



                <div className="flex flex-col items-start">

  <span>{customer.name}</span>

  {customer.phone && (

    <span className="text-xs text-gray-500">

      {customer.phone}

    </span>

  )}

</div>

              </button>

            ))

          )}

        </div>

      )}

    </div>

    {selectedCustomer && (

      <p className="mt-2 text-xs text-[#7b5a49]">

        Current pending balance:{" "}

        {money(Number(selectedCustomer.pendingBalance || 0))}

      </p>

    )}

    {!editingSaleId && (

      <button

        type="button"

        onClick={() => {

          setNewCustomer(true);

          setCustomerId("");

          setCustomerSearch("");

          setShowCustomerList(false);

        }}

        className="mt-3 text-sm font-semibold text-[#c85f22] hover:underline"

      >

        + Add Customer

      </button>

    )}

  </>

) : (

  <>

    <input

      value={newCustomerName}

      onChange={(event) => setNewCustomerName(event.target.value)}

      placeholder="Enter new customer name"

      required

      maxLength={200}

      className={inputClass}

    />

    <button

      type="button"

      onClick={() => {

        setNewCustomer(false);

        setNewCustomerName("");

      }}

      className="mt-2 text-sm font-semibold text-[#c85f22] hover:underline"

    >

      Choose existing customer instead

    </button>

    <p className="mt-1 text-xs text-[#9a7865]">

      The customer will be created when this sale is saved.

    </p>

  </>

)}

                </div>



<div>

  <label className="mb-1 block text-sm font-medium text-[#5b3928]">

    Mobile Number

  </label>



  <input

    type="tel"

    value={newCustomerPhone}

    onChange={(event) =>

      setNewCustomerPhone(event.target.value)

    }

    maxLength={20}

    placeholder="Enter mobile number (optional)"

    className="w-full rounded-xl border border-[#e5cdbd] px-4 py-3 text-[#3b2117] outline-none focus:border-[#d96f2b]"

  />

</div>



                <div>

                  <label className="block text-sm font-semibold text-[#5b3928]">

                    Sale Date

                  </label>

                  <input

                    type="date"

                    value={saleDate}

                    onChange={(event) => setSaleDate(event.target.value)}

                    required

                    className={inputClass}

                  />

                </div>

                <div className="border-t border-[#ead8c9] pt-4">

                  <div className="flex items-center justify-between">

                    <h3 className="font-semibold text-[#3b2117]">

                      Products ({items.length})

                    </h3>

                  </div>

                  <div className="relative mt-3">

                    <input

                      value={productSearch}

                      onFocus={() => setShowProductList(true)}

                      onChange={(event) => {

                        setProductSearch(event.target.value);

                        setShowProductList(true);

                      }}

                      placeholder="Search product to add..."

                      className={inputClass}

                    />

                    {showProductList && (

                      <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-[#e8d4c5] bg-white shadow-lg">

                        {filteredProducts.length === 0 ? (

                          <p className="p-3 text-sm text-[#7b5a49]">

                            No matching products available to add.

                          </p>

                        ) : (

                          filteredProducts.map((product) => (

                            <button

                              key={product.id}

                              type="button"

                              onClick={() => addProduct(product)}

                              className="flex w-full items-center justify-between border-b border-[#f5e9e0] px-3 py-3 text-left last:border-b-0 hover:bg-[#fff7ed]"

                            >

                              <span>

                                <span className="block text-sm font-medium text-[#3b2117]">

                                  {product.name}

                                </span>

                                {product.code && (

                                  <span className="text-xs text-[#9a7865]">

                                    {product.code}

                                  </span>

                                )}

                              </span>

                              <span className="ml-3 whitespace-nowrap text-xs text-[#7b5a49]">

                                Stock: {product.stock}

                              </span>

                            </button>

                          ))

                        )}

                      </div>

                    )}

                  </div>

                  {showProductList && (

                    <button

                      type="button"

                      onClick={() => setShowProductList(false)}

                      className="mt-1 text-xs text-[#9a7865] hover:underline"

                    >

                      Close product list

                    </button>

                  )}

                </div>

                <div className="space-y-4">

                  {items.map((item, index) => {

                    const product = products.find(

                      (p) => p.id === item.productId

                    );

                    return (

                      <div

                        key={item.productId || `empty-${index}`}

                        className="rounded-xl border border-[#f1dfd2] bg-[#fffaf6] p-4"

                      >

                        <div className="flex items-start justify-between gap-3">

                          <div>

                            <p className="text-xs font-semibold text-[#a66a4a]">

                              PRODUCT {index + 1}

                            </p>

                            <p className="mt-1 font-semibold text-[#3b2117]">

                              {product?.name || "Choose a product above"}

                            </p>

                            {product && (

                              <p className="mt-1 text-xs text-[#7b5a49]">

                                Available stock: {product.stock}

                              </p>

                            )}

                          </div>

                          <button

                            type="button"

                            onClick={() => removeProduct(index)}

                            className="text-sm font-semibold text-red-600 hover:underline"

                            aria-label={`Remove product ${index + 1}`}

                          >

                            Remove

                          </button>

                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <label className="text-sm text-[#5b3928]">
                            Quantity (Nos)
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity}
                              onChange={(event) =>
                                updateItem(index, "quantity", event.target.value)
                              }
                              required
                              className={inputClass}
                            />
                          </label>

                          <label className="text-sm text-[#5b3928]">
                            Sales Unit
                            <select
                              value={item.salesUnit}
                              onChange={(event) => {
                                const unit = event.target.value as SalesUnit;
                                setItems((previous) =>
                                  previous.map((line, i) =>
                                    i === index
                                      ? {
                                          ...line,
                                          salesUnit: unit,
                                          inventoryDeductionKg:
                                            unit === "KGS"
                                              ? ""
                                              : line.inventoryDeductionKg,
                                        }
                                      : line,
                                  ),
                                );
                              }}
                              className={inputClass}
                            >
                              <option value="KGS">KGS</option>
                              <option value="SQ_FT">SQ_FT</option>
                              <option value="R_FT">R_FT</option>
                              <option value="R_MTR">R_MTR</option>
                            </select>
                          </label>

                          <label className="text-sm text-[#5b3928]">
                            Sales Measurement ({unitLabels[item.salesUnit]})
                            <input
                              type="number"
                              min="0.001"
                              step="0.001"
                              value={item.salesMeasurement}
                              onChange={(event) =>
                                updateItem(index, "salesMeasurement", event.target.value)
                              }
                              placeholder="0.000"
                              required
                              className={inputClass}
                            />
                          </label>

                          {item.salesUnit !== "KGS" && (
                            <label className="text-sm text-[#5b3928]">
                              Inventory Deduction (Kgs)
                              <input
                                type="number"
                                min="0.001"
                                step="0.001"
                                value={item.inventoryDeductionKg}
                                onChange={(event) =>
                                  updateItem(index, "inventoryDeductionKg", event.target.value)
                                }
                                placeholder="Enter stock deduction in kg"
                                required
                                className={inputClass}
                              />
                            </label>
                          )}

                          <label className="text-sm text-[#5b3928]">
                            Rate / {unitLabels[item.salesUnit]}
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.rate}
                              onChange={(event) =>
                                updateItem(index, "rate", event.target.value)
                              }
                              placeholder={`Rate per ${unitLabels[item.salesUnit]}`}
                              required
                              className={inputClass}
                            />
                          </label>

                          <div>
                            <span className="text-sm text-[#5b3928]">Amount</span>
                            <div className="mt-1 flex h-11 items-center rounded-xl border border-[#ead8c9] bg-[#f8f2ec] px-3 font-semibold text-[#3b2117]">
                              {money(lineAmounts[index])}
                            </div>
                          </div>
                        </div>

                      </div>

                    );

                  })}

                </div>

                <div className="rounded-xl bg-[#fff7ed] p-4">

                  <div className="flex items-center justify-between">

                    <span className="font-semibold text-[#5b3928]">

                      Total Amount

                    </span>

                    <span className="text-xl font-bold text-[#3b2117]">

                      {money(totalAmount)}

                    </span>

                  </div>

                  <p className="mt-2 text-xs text-[#9a7865]">

                    Amount = Sales Measurement × Rate per Unit. Inventory deductions are always calculated in kilograms.

                  </p>

                </div>

                <button

                  type="submit"

                  disabled={saving || items.length === 0}

                  className="w-full rounded-xl bg-[#d96f2b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c85f22] disabled:cursor-not-allowed disabled:opacity-60"

                >

                  {saving

                    ? "Saving..."

                    : editingSaleId

                      ? "Update Sale"

                      : "Create Sale"}

                </button>

                {editingSaleId && (

                  <button

                    type="button"

                    disabled={saving}

                    onClick={() => {

                      resetForm();

                      setError("");

                      setSuccess("");

                    }}

                    className="w-full rounded-xl border border-[#e8d4c5] px-5 py-3 text-sm font-semibold text-[#5b3928] hover:bg-[#fff7ed] disabled:opacity-60"

                  >

                    Cancel Edit

                  </button>

                )}

                {stockConfirmation && (

                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">

                    <h3 className="font-semibold text-amber-900">

                      Insufficient stock

                    </h3>

                    <p className="mt-1 text-sm text-amber-800">

                      Some products do not have enough stock. Continuing will

                      deduct only the available quantity.

                    </p>

                    <ul className="mt-3 space-y-1 text-sm text-amber-900">

                      {stockConfirmation.shortages.map((shortage, index) => (

                        <li key={`${shortage.productId}-${index}`}>

                          {shortage.productName || "Product"}: requested{" "}

                          {shortage.requested ?? "—"}, available{" "}

                          {shortage.available ?? "—"}

                        </li>

                      ))}

                    </ul>

                    <div className="mt-4 flex gap-3">

                      <button

                        type="button"

                        disabled={saving}

                        onClick={() => setStockConfirmation(null)}

                        className="flex-1 rounded-lg border border-amber-400 px-3 py-2 text-sm font-semibold text-amber-900"

                      >

                        Cancel

                      </button>

                      <button

                        type="button"

                        disabled={saving}

                       onClick={() => {

  void handleCreateSale(

    { preventDefault: () => {} } as React.FormEvent<HTMLFormElement>,

    true

  );

}}

                        className="flex-1 rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white"

                      >

                        {saving ? "Saving..." : editingSaleId ? "Continue Update" : "Continue Sale"}

                      </button>

                    </div>

                  </div>

                )}

              </form>

            </section>

            <section className="min-w-0 rounded-2xl border border-[#f1dfd2] bg-white p-5 shadow-sm sm:p-6">

              <div className="flex items-center justify-between gap-3">

                <div>

                  <h2 className="text-lg font-semibold text-[#3b2117]">

                    Sales History

                  </h2>

                  <p className="mt-1 text-sm text-[#7b5a49]">

                    Recent sales and saved product details.

                  </p>

                </div>

                <span className="rounded-full bg-[#fff1e6] px-3 py-1 text-xs font-semibold text-[#a64b2b]">

                  {sales.length} sales

                </span>

              </div>

              {sales.length === 0 ? (

                <div className="mt-8 rounded-xl border border-dashed border-[#e5cdbd] bg-[#fffaf6] p-10 text-center">

                  <p className="font-medium text-[#5b2f1f]">No sales yet.</p>

                  <p className="mt-2 text-sm text-[#8b6b5a]">

                    Create your first sale using the form.

                  </p>

                </div>

              ) : (

                <div className="mt-6 space-y-4">

                  {sales.map((sale) => {

                    const saleItems =

                      sale.items?.length

                        ? sale.items

                        : [

                            {

  id: "",

  productId: "",

  productName: "",

  quantity: 1,

  weight: 0,

  salesMeasurement: 0,

  salesUnit: "KGS" as const,

  rate: 0,

  amount: 0,

},

                          ];

                    return (

                      <article

                        key={sale.id}

                        className="rounded-xl border border-[#f1dfd2] bg-[#fffaf6] p-4"

                      >

                        <div className="flex flex-col justify-between gap-3 sm:flex-row">

                          <div>

                            <p className="font-semibold text-[#3b2117]">

                              {sale.customer.name}

                            </p>

                            <p className="mt-1 text-xs text-[#7b5a49]">

                              Sale date:{" "}

                              {new Date(sale.saleDate).toLocaleDateString()}

                            </p>

                            <p className="mt-1 text-xs text-[#7b5a49]">

                              Created by: {sale.createdBy?.name || "—"}

                            </p>

                          </div>

                          <div className="flex items-start gap-2">

                            <span

                              className={`rounded-full px-3 py-1 text-xs font-semibold ${

                                sale.status === "ACTIVE"

                                  ? "bg-green-100 text-green-700"

                                  : "bg-red-100 text-red-700"

                              }`}

                            >

                              {sale.status}

                            </span>



{sale.status === "ACTIVE" && (

  <>

    <button

      type="button"

      onClick={() => handleEditSale(sale)}

      disabled={saving}

      className="rounded-lg bg-[#d96f2b] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#c85f22] disabled:opacity-60"

    >

      Edit

    </button>



    <button

      type="button"

      onClick={() => handleDeleteSale(sale.id)}

      disabled={saving}

      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"

    >

      Delete

    </button>



    <DownloadSaleEstimatePdf

      data={{

        customerName: sale.customer.name,

        customerPhone: newCustomer

  ? newCustomerPhone.trim() || null

  : selectedCustomer?.phone ?? null,

        saleDate: sale.saleDate,

        items: saleItems.map((item) => ({

  productName: item.productName,

  quantity: item.quantity,

  salesMeasurement: item.salesMeasurement ?? item.weight,

  salesUnit: item.salesUnit ?? "KGS",

  rate: item.rate,

  amount: item.amount,

})),

        totalAmount: Number(sale.amount),

      }}

    />

  </>

)}



                          </div>

                        </div>

                        <div className="mt-4 overflow-x-auto">

                          <table className="w-full min-w-[440px] text-left text-sm">

                            <thead>

                              <tr className="border-b border-[#ead8c9] text-xs text-[#8b6b5a]">

                                <th className="py-2 pr-3">Product</th>

                                <th className="py-2 pr-3">Qty</th>

                                <th className="py-2 pr-3">Sales Measurement</th>

                                <th className="py-2 pr-3">Rate / Unit</th>

                                <th className="py-2 text-right">Amount</th>

                              </tr>

                            </thead>

                            <tbody>

                              {saleItems.map((item, index) => (

                                <tr

                                  key={item.id || `${item.productId}-${index}`}

                                  className="border-b border-[#f3e8df] last:border-0"

                                >

                                  <td className="py-2 pr-3 font-medium text-[#3b2117]">

                                    {item.productName}

                                  </td>

                                  <td className="py-2 pr-3">

                                    {item.quantity}

                                  </td>

                                  <td className="py-2 pr-3">

                                    {Number(item.salesMeasurement ?? item.weight).toFixed(2)} {unitLabels[item.salesUnit ?? "KGS"]}

                                  </td>

                                  <td className="py-2 pr-3">
                                    {money(Number(item.rate))} / {unitLabels[item.salesUnit ?? "KGS"]}
                                  </td>

                                  <td className="py-2 text-right font-medium">

                                    {money(Number(item.amount))}

                                  </td>

                                </tr>

                              ))}

                            </tbody>

                          </table>

                        </div>

                        <div className="mt-3 flex flex-wrap justify-between gap-3 border-t border-[#ead8c9] pt-3">

                          <div className="text-sm text-[#7b5a49]">

                            <p>

                              Paid:{" "}

                              <span className="font-semibold text-green-700">

                                {money(Number(sale.totalPaid))}

                              </span>

                            </p>

                            <p className="mt-1">

                              Pending:{" "}

                              <span className="font-semibold text-red-600">

                                {money(Number(sale.balance))}

                              </span>

                            </p>

                          </div>

                          <p className="text-lg font-bold text-[#3b2117]">

                            Total: {money(Number(sale.amount))}

                          </p>

                        </div>

                      </article>

                    );

                  })}

                </div>

              )}

            </section>

          </div>

        </div>

      </main>

    </div>

  );

}
