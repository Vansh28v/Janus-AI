"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Download,
  Package,
  RefreshCw,
  ShieldCheck,
  Truck,
  Users,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ActiveDataSource from "@/components/active-data-source";

type Supplier = {
  supplier_code: string;
  supplier_name: string;
  average_lead_time_days: number;
  lead_time_std_days: number;
  reliability_score: number;
  status: string;
  total_orders: number;
  outstanding_orders: number;
  emergency_orders: number;
  total_spend: number;
  received_orders: number;
  delayed_received_orders: number;
  average_actual_lead_time: number;
  average_expected_lead_time: number;
  on_time_orders: number;
  on_time_rate_pct: number;
  delay_rate_pct: number;
  lead_time_variance_days: number;
};

type SupplierSummary = {
  total_suppliers: number;
  total_orders: number;
  received_orders: number;
  outstanding_orders: number;
  delayed_received_orders: number;
  on_time_received_orders: number;
  emergency_orders: number;
  total_procurement_spend: number;
  overall_on_time_rate_pct: number;
};

type SupplierResponse = {
  source: string;
  summary: SupplierSummary;
  suppliers: Supplier[];
};

const API_URL = "http://localhost:8000/api/suppliers/overview";
const GOLD = "#C9A362";
const MUTED = "#898276";
const GRID = "#29251E";

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatCurrency = (value: number) => {
  if (!Number.isFinite(value)) return "₹0";
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return `₹${formatNumber(value)}`;
};

const formatPercent = (value: number) =>
  `${Number(value || 0).toFixed(1)}%`;

const formatDays = (value: number) =>
  `${Number(value || 0).toFixed(1)} days`;

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const getDeliveryColor = (rate: number) => {
  if (rate >= 60) return "#91A982";
  if (rate >= 50) return GOLD;
  return "#D77C72";
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#C9A362]">
      {children}
    </p>
  );
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "gold",
}: {
  label: string;
  value: string;
  description: string;
  icon: React.ElementType;
  tone?: "gold" | "red" | "green" | "neutral";
}) {
  const toneStyles = {
    gold: "border-[#5A4526] bg-[#C9A362]/[0.07] text-[#E6C98E]",
    red: "border-red-500/30 bg-red-500/[0.07] text-red-300",
    green: "border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-300",
    neutral: "border-[#39342A] bg-[#C9A362]/[0.04] text-[#D8C8A8]",
  };

  return (
    <div className="rounded-lg border border-[#302A20] bg-[#10100F] p-5 transition duration-200 hover:border-[#70552D]">
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-[75%] text-[10px] font-medium uppercase tracking-[0.17em] text-[#898276]">
          {label}
        </p>
        <div className={`rounded-md border p-2 ${toneStyles[tone]}`}>
          <Icon size={17} />
        </div>
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-tight text-[#F1E8D8]">
        {value}
      </p>
      <p className="mt-2 text-xs text-[#777166]">{description}</p>
    </div>
  );
}

function ProgressBar({
  value,
  color = GOLD,
}: {
  value: number;
  color?: string;
}) {
  const safeValue = Math.min(100, Math.max(0, value || 0));

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#29251F]">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${safeValue}%`, backgroundColor: color }}
      />
    </div>
  );
}

export default function SupplierIntelligencePage() {
  const [data, setData] = useState<SupplierResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("on_time_rate_pct");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const fetchSupplierData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const response = await fetch(API_URL, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(
          `Unable to load supplier data. Server responded with ${response.status}.`
        );
      }

      const result: SupplierResponse = await response.json();

      if (!result || !result.summary || !Array.isArray(result.suppliers)) {
        throw new Error("The supplier API returned an unexpected response.");
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading supplier intelligence."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSupplierData();
  }, [fetchSupplierData]);

  const summary = data?.summary;
  const isSynthetic =
    (data?.source || "").toUpperCase().includes("SYNTHETIC");

  const filteredSuppliers = useMemo(() => {
    if (!data) return [];

    const query = search.trim().toLowerCase();
    const filtered = data.suppliers.filter(
      (supplier) =>
        supplier.supplier_name.toLowerCase().includes(query) ||
        supplier.supplier_code.toLowerCase().includes(query)
    );

    return [...filtered].sort((a, b) => {
      const first = Number(a[sortBy as keyof Supplier] || 0);
      const second = Number(b[sortBy as keyof Supplier] || 0);
      return sortOrder === "desc" ? second - first : first - second;
    });
  }, [data, search, sortBy, sortOrder]);

  const deliveryChartData = useMemo(() => {
    if (!data) return [];
    return [...data.suppliers]
      .sort((a, b) => b.on_time_rate_pct - a.on_time_rate_pct)
      .map((supplier) => ({
        name: supplier.supplier_code,
        fullName: supplier.supplier_name,
        onTimeRate: supplier.on_time_rate_pct,
        delayedOrders: supplier.delayed_received_orders,
      }));
  }, [data]);

  const spendChartData = useMemo(() => {
    if (!data) return [];
    return [...data.suppliers]
      .sort((a, b) => b.total_spend - a.total_spend)
      .map((supplier) => ({
        name: supplier.supplier_code,
        fullName: supplier.supplier_name,
        spend: Number((supplier.total_spend / 10000000).toFixed(2)),
      }));
  }, [data]);

  const delayedRate =
    summary && summary.received_orders > 0
      ? (summary.delayed_received_orders / summary.received_orders) * 100
      : 0;

  const emergencyRate =
    summary && summary.total_orders > 0
      ? (summary.emergency_orders / summary.total_orders) * 100
      : 0;

  const exportSupplierData = () => {
    if (!data) return;

    const headers = [
      "Supplier Code",
      "Supplier Name",
      "Total Orders",
      "Received Orders",
      "Outstanding Orders",
      "Delayed Received Orders",
      "On-Time Orders",
      "On-Time Rate (%)",
      "Emergency Orders",
      "Average Actual Lead Time (Days)",
      "Average Expected Lead Time (Days)",
      "Lead Time Variance (Days)",
      "Total Spend (INR)",
      "Reliability Score (Master Data)",
    ];

    const rows = filteredSuppliers.map((supplier) => [
      supplier.supplier_code,
      supplier.supplier_name,
      supplier.total_orders,
      supplier.received_orders,
      supplier.outstanding_orders,
      supplier.delayed_received_orders,
      supplier.on_time_orders,
      supplier.on_time_rate_pct,
      supplier.emergency_orders,
      supplier.average_actual_lead_time,
      supplier.average_expected_lead_time,
      supplier.lead_time_variance_days,
      supplier.total_spend,
      supplier.reliability_score,
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "gridstock-supplier-intelligence.csv";
    anchor.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#080807] text-[#F1E8D8]">
      <header className="sticky top-0 z-30 flex h-[92px] items-center justify-between border-b border-[#29251F] bg-[#080807]/95 px-6 backdrop-blur-xl lg:px-10">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#777166]">
            <Link href="/dashboard" className="transition hover:text-[#E6C98E]">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-[#C9A362]">Supplier Intelligence</span>
          </div>
          <h1 className="mt-1 text-base font-semibold text-[#F1E8D8]">
            Supplier Intelligence
          </h1>
        </div>

        <button
          onClick={() => fetchSupplierData(true)}
          disabled={loading || refreshing}
          className="flex items-center gap-2 rounded-md border border-[#57452A] px-4 py-3 text-sm text-[#E6C98E] transition hover:bg-[#C9A362]/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={refreshing ? "animate-spin" : ""}
          />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      <main className="px-6 py-10 lg:px-10">
        <section className="mb-10">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#70552D] bg-[#C9A362]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#E6C98E]">
              Procurement Intelligence
            </span>
          </div>

          <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
            <div>
              <SectionLabel>SUPPLY CHAIN PERFORMANCE</SectionLabel>
              <h2 className="text-4xl font-semibold tracking-tight text-[#F1E8D8] md:text-5xl">
                Supplier <span className="text-[#D9B978]">Intelligence.</span>
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#898276]">
                Evaluate supplier delivery performance, monitor procurement
                activity and identify supply chain risks using the currently
                selected dataset.
              </p>
            </div>

            <div className="flex flex-wrap items-stretch gap-3">
              <ActiveDataSource workspace="suppliers" />
              <div className="min-w-[170px] rounded-lg border border-[#393126] bg-[#10100F] px-5 py-4">
                <p className="text-[9px] uppercase tracking-[0.2em] text-[#898276]">
                  Supplier network
                </p>
                <p className="mt-2 text-sm font-semibold text-[#F1E8D8]">
                  {summary ? `${summary.total_suppliers} Suppliers` : "—"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-8 flex flex-col gap-4 rounded-lg border border-red-500/30 bg-red-500/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 shrink-0 text-red-300" size={20} />
              <div>
                <p className="text-sm font-semibold text-red-200">
                  Unable to load supplier intelligence
                </p>
                <p className="mt-1 text-xs leading-6 text-red-200/70">
                  {error}
                </p>
                <p className="mt-1 text-xs text-[#898276]">
                  Check that the FastAPI backend is running on port 8000.
                </p>
              </div>
            </div>
            <button
              onClick={() => fetchSupplierData()}
              className="flex shrink-0 items-center justify-center gap-2 rounded-md border border-red-400/30 px-4 py-2.5 text-xs text-red-200 transition hover:bg-red-400/10"
            >
              <RefreshCw size={14} />
              Try again
            </button>
          </div>
        )}

        {loading && !data && (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-[#302A20] bg-[#10100F]">
            <div className="mb-5 h-9 w-9 animate-spin rounded-full border-2 border-[#57452A] border-t-[#E6C98E]" />
            <p className="text-sm font-medium text-[#E6C98E]">
              Analysing supplier network...
            </p>
            <p className="mt-2 text-xs text-[#777166]">
              Fetching procurement and delivery performance data
            </p>
          </div>
        )}

        {data && summary && (
          <>
                      <section className="mb-12">
              <SectionLabel>PROCUREMENT OVERVIEW</SectionLabel>
              <h3 className="text-2xl font-semibold tracking-tight">
                Supplier network at a glance
              </h3>
              <p className="mt-2 text-sm text-[#898276]">
                Portfolio-level indicators calculated from the active purchase
                order history.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Total suppliers"
                  value={formatNumber(summary.total_suppliers)}
                  description="Suppliers in the active dataset"
                  icon={Users}
                  tone="gold"
                />
                <MetricCard
                  label="Total purchase orders"
                  value={formatNumber(summary.total_orders)}
                  description={`${formatNumber(summary.received_orders)} received orders`}
                  icon={Package}
                  tone="neutral"
                />
                <MetricCard
                  label="Overall on-time rate"
                  value={formatPercent(summary.overall_on_time_rate_pct)}
                  description="Share of received orders delivered on time"
                  icon={CheckCircle2}
                  tone="green"
                />
                <MetricCard
                  label="Procurement spend"
                  value={formatCurrency(summary.total_procurement_spend)}
                  description="Total recorded procurement value"
                  icon={Wallet}
                  tone="gold"
                />
              </div>
            </section>

            <section className="mb-12">
              <SectionLabel>ORDER STATUS & DELIVERY RISKS</SectionLabel>
              <h3 className="text-2xl font-semibold tracking-tight">
                Procurement activity
              </h3>
              <p className="mt-2 text-sm text-[#898276]">
                Understand the current order mix and identify delivery
                bottlenecks.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Received orders"
                  value={formatNumber(summary.received_orders)}
                  description="Orders with recorded receipt"
                  icon={CheckCircle2}
                  tone="green"
                />
                <MetricCard
                  label="Outstanding orders"
                  value={formatNumber(summary.outstanding_orders)}
                  description="Orders not yet received"
                  icon={Truck}
                  tone="gold"
                />
                <MetricCard
                  label="Delayed received orders"
                  value={formatNumber(summary.delayed_received_orders)}
                  description={`${formatPercent(delayedRate)} of received orders`}
                  icon={AlertTriangle}
                  tone="red"
                />
                <MetricCard
                  label="Emergency orders"
                  value={formatNumber(summary.emergency_orders)}
                  description={`${formatPercent(emergencyRate)} of all purchase orders`}
                  icon={Zap}
                  tone="neutral"
                />
              </div>
            </section>

            <section className="mb-12">
              <SectionLabel>SUPPLIER PERFORMANCE ANALYTICS</SectionLabel>
              <h3 className="text-2xl font-semibold tracking-tight">
                Delivery & procurement insights
              </h3>
              <p className="mt-2 text-sm text-[#898276]">
                Compare supplier delivery outcomes and procurement
                expenditure.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-5 2xl:grid-cols-2">
                <div className="rounded-lg border border-[#302A20] bg-[#10100F] p-5 sm:p-6">
                  <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-base font-semibold">
                        On-time delivery performance
                      </h4>
                      <p className="mt-1 text-xs text-[#898276]">
                        Received orders delivered on schedule
                      </p>
                    </div>
                    <div className="rounded-md border border-[#57452A] bg-[#C9A362]/10 px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#E6C98E]">
                      Supplier comparison
                    </div>
                  </div>

                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={deliveryChartData}
                        margin={{ top: 10, right: 10, left: -18, bottom: 5 }}
                      >
                        <CartesianGrid
                          stroke={GRID}
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: MUTED, fontSize: 10 }}
                          axisLine={{ stroke: GRID }}
                          tickLine={false}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fill: MUTED, fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip
                          cursor={{ fill: "#C9A362", opacity: 0.06 }}
                          contentStyle={{
                            backgroundColor: "#171613",
                            border: "1px solid #57452A",
                            borderRadius: "8px",
                            color: "#F1E8D8",
                            fontSize: "12px",
                          }}
                          formatter={(value) => [
                            `${Number(value).toFixed(2)}%`,
                            "On-time rate",
                          ]}
                          labelFormatter={(label, payload) =>
                            payload?.[0]?.payload?.fullName || label
                          }
                        />
                        <Bar
                          dataKey="onTimeRate"
                          name="On-time rate"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={42}
                        >
                          {deliveryChartData.map((entry, index) => (
                            <Cell
                              key={`delivery-${index}`}
                              fill={getDeliveryColor(entry.onTimeRate)}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <p className="mt-3 text-[10px] leading-5 text-[#777166]">
                    Calculated as on-time received orders divided by total
                    received orders for each supplier. Outstanding orders are
                    excluded.
                  </p>
                </div>

                <div className="rounded-lg border border-[#302A20] bg-[#10100F] p-5 sm:p-6">
                  <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-base font-semibold">
                        Procurement spend by supplier
                      </h4>
                      <p className="mt-1 text-xs text-[#898276]">
                        Total recorded purchase order value
                      </p>
                    </div>
                    <div className="rounded-md border border-[#57452A] bg-[#C9A362]/10 px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#E6C98E]">
                      Spend analysis
                    </div>
                  </div>

                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={spendChartData}
                        margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid
                          stroke={GRID}
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: MUTED, fontSize: 10 }}
                          axisLine={{ stroke: GRID }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: MUTED, fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(value) => `₹${value} Cr`}
                        />
                        <Tooltip
                          cursor={{ fill: "#C9A362", opacity: 0.06 }}
                          contentStyle={{
                            backgroundColor: "#171613",
                            border: "1px solid #57452A",
                            borderRadius: "8px",
                            color: "#F1E8D8",
                            fontSize: "12px",
                          }}
                          formatter={(value) => [
                            `₹${Number(value).toFixed(2)} Cr`,
                            "Procurement spend",
                          ]}
                          labelFormatter={(label, payload) =>
                            payload?.[0]?.payload?.fullName || label
                          }
                        />
                        <Bar
                          dataKey="spend"
                          name="Spend"
                          fill={GOLD}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={42}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <p className="mt-3 text-[10px] leading-5 text-[#777166]">
                    Values are displayed in crore rupees (₹ Cr), based on
                    purchase order expenditure in the active dataset.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-12">
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                <div>
                  <SectionLabel>SUPPLIER DIRECTORY</SectionLabel>
                  <h3 className="text-2xl font-semibold tracking-tight">
                    Supplier performance
                  </h3>
                  <p className="mt-2 text-sm text-[#898276]">
                    Compare delivery reliability, order volumes, lead times
                    and procurement expenditure.
                  </p>
                </div>

                <button
                  onClick={exportSupplierData}
                  className="flex items-center justify-center gap-2 rounded-md border border-[#57452A] px-4 py-3 text-xs font-medium text-[#E6C98E] transition hover:bg-[#C9A362]/10"
                >
                  <Download size={15} />
                  Export CSV
                </button>
              </div>

              <div className="mt-6 flex flex-col gap-3 rounded-lg border border-[#302A20] bg-[#10100F] p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#D8C8A8]">
                    Supplier records
                  </p>
                  <p className="mt-1 text-[11px] text-[#777166]">
                    Showing {filteredSuppliers.length} of{" "}
                    {data.suppliers.length} suppliers
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search supplier or code..."
                    className="w-full rounded-md border border-[#393126] bg-[#080807] px-4 py-3 text-xs text-[#F1E8D8] outline-none transition placeholder:text-[#69645B] focus:border-[#9B7940] sm:w-[240px]"
                  />

                  <select
                    value={sortBy}
                    onChange={(event) => {
                      setSortBy(event.target.value);
                      setSortOrder("desc");
                    }}
                    className="rounded-md border border-[#393126] bg-[#080807] px-4 py-3 text-xs text-[#D8C8A8] outline-none focus:border-[#9B7940]"
                  >
                    <option value="on_time_rate_pct">
                      Sort: On-time rate
                    </option>
                    <option value="total_orders">Sort: Total orders</option>
                    <option value="total_spend">
                      Sort: Procurement spend
                    </option>
                    <option value="average_actual_lead_time">
                      Sort: Actual lead time
                    </option>
                    <option value="delayed_received_orders">
                      Sort: Delayed orders
                    </option>
                  </select>

                  <button
                    onClick={() =>
                      setSortOrder((current) =>
                        current === "desc" ? "asc" : "desc"
                      )
                    }
                    className="flex items-center justify-center gap-2 rounded-md border border-[#393126] px-4 py-3 text-xs text-[#D8C8A8] transition hover:border-[#9B7940]"
                  >
                    {sortOrder === "desc" ? (
                      <ArrowDownRight size={14} />
                    ) : (
                      <ArrowUpRight size={14} />
                    )}
                    {sortOrder === "desc" ? "Descending" : "Ascending"}
                  </button>
                </div>
              </div>
                            <div className="mt-4 overflow-hidden rounded-lg border border-[#302A20] bg-[#10100F]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1150px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[#393126] bg-[#151410]">
                        <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#898276]">
                          Supplier
                        </th>
                        <th className="px-4 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-[#898276]">
                          Total POs
                        </th>
                        <th className="px-4 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-[#898276]">
                          Received
                        </th>
                        <th className="px-4 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-[#898276]">
                          Outstanding
                        </th>
                        <th className="px-5 py-4 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[#898276]">
                          On-time delivery
                        </th>
                        <th className="px-4 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-[#898276]">
                          Delayed
                        </th>
                        <th className="px-4 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-[#898276]">
                          Avg. lead time
                        </th>
                        <th className="px-4 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-[#898276]">
                          Lead variance
                        </th>
                        <th className="px-4 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-[#898276]">
                          Emergency POs
                        </th>
                        <th className="px-5 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-[#898276]">
                          Total spend
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredSuppliers.map((supplier) => {
                        const deliveryColor = getDeliveryColor(
                          supplier.on_time_rate_pct
                        );

                        return (
                          <tr
                            key={supplier.supplier_code}
                            className="border-b border-[#29251F] transition hover:bg-[#C9A362]/[0.035]"
                          >
                            <td className="px-5 py-5">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#57452A] bg-[#C9A362]/10 text-[10px] font-semibold text-[#E6C98E]">
                                  {getInitials(supplier.supplier_name)}
                                </div>
                                <div>
                                  <p className="max-w-[220px] text-xs font-semibold text-[#EDE4D4]">
                                    {supplier.supplier_name}
                                  </p>
                                  <p className="mt-1 text-[10px] tracking-wider text-[#777166]">
                                    {supplier.supplier_code}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-5 text-right text-xs tabular-nums text-[#D8C8A8]">
                              {formatNumber(supplier.total_orders)}
                            </td>
                            <td className="px-4 py-5 text-right text-xs tabular-nums text-emerald-300">
                              {formatNumber(supplier.received_orders)}
                            </td>
                            <td className="px-4 py-5 text-right text-xs tabular-nums text-[#E6C98E]">
                              {formatNumber(supplier.outstanding_orders)}
                            </td>

                            <td className="min-w-[165px] px-5 py-5">
                              <div className="flex items-center justify-between gap-3">
                                <span
                                  className="text-xs font-semibold tabular-nums"
                                  style={{ color: deliveryColor }}
                                >
                                  {formatPercent(supplier.on_time_rate_pct)}
                                </span>
                              </div>
                              <div className="mt-2">
                                <ProgressBar
                                  value={supplier.on_time_rate_pct}
                                  color={deliveryColor}
                                />
                              </div>
                            </td>

                            <td className="px-4 py-5 text-right text-xs tabular-nums text-red-300">
                              {formatNumber(supplier.delayed_received_orders)}
                            </td>
                            <td className="px-4 py-5 text-right text-xs tabular-nums text-[#D8C8A8]">
                              {formatDays(supplier.average_actual_lead_time)}
                            </td>
                            <td className="px-4 py-5 text-right text-xs tabular-nums text-[#D8C8A8]">
                              {formatDays(supplier.lead_time_variance_days)}
                            </td>
                            <td className="px-4 py-5 text-right text-xs tabular-nums text-[#E6C98E]">
                              {formatNumber(supplier.emergency_orders)}
                            </td>
                            <td className="px-5 py-5 text-right text-xs font-semibold tabular-nums text-[#E6C98E]">
                              {formatCurrency(supplier.total_spend)}
                            </td>
                          </tr>
                        );
                      })}

                      {filteredSuppliers.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-5 py-12 text-center">
                            <Users
                              size={25}
                              className="mx-auto mb-3 text-[#777166]"
                            />
                            <p className="text-sm text-[#D8C8A8]">
                              No suppliers found
                            </p>
                            <p className="mt-1 text-xs text-[#777166]">
                              Try a different supplier name or code.
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="mt-3 text-[10px] leading-5 text-[#777166]">
                On-time delivery rate is calculated using received orders
                only. Outstanding orders are not classified as delayed.
              </p>
            </section>

            <section className="mb-12">
              <SectionLabel>DECISION INTELLIGENCE</SectionLabel>
              <h3 className="text-2xl font-semibold tracking-tight">
                Network observations
              </h3>
              <p className="mt-2 text-sm text-[#898276]">
                Key indicators derived from the active supplier dataset.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="rounded-lg border border-[#302A20] bg-[#10100F] p-5">
                  <div className="mb-4 flex items-center gap-2 text-[#E6C98E]">
                    <Activity size={17} />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.17em]">
                      Delivery performance
                    </span>
                  </div>
                  <p className="text-2xl font-semibold">
                    {formatPercent(summary.overall_on_time_rate_pct)}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-[#898276]">
                    Overall on-time delivery rate across received purchase
                    orders in the active dataset.
                  </p>
                </div>

                <div className="rounded-lg border border-[#302A20] bg-[#10100F] p-5">
                  <div className="mb-4 flex items-center gap-2 text-red-300">
                    <AlertTriangle size={17} />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.17em]">
                      Delivery delays
                    </span>
                  </div>
                  <p className="text-2xl font-semibold">
                    {formatNumber(summary.delayed_received_orders)}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-[#898276]">
                    Received orders recorded as delayed. Outstanding orders
                    are tracked separately.
                  </p>
                </div>

                <div className="rounded-lg border border-[#302A20] bg-[#10100F] p-5">
                  <div className="mb-4 flex items-center gap-2 text-[#E6C98E]">
                    <Wallet size={17} />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.17em]">
                      Procurement exposure
                    </span>
                  </div>
                  <p className="text-2xl font-semibold">
                    {formatCurrency(summary.total_procurement_spend)}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-[#898276]">
                    Aggregate procurement spend represented in the active
                    purchase order records.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-[#57452A]/70 bg-[#C9A362]/[0.045] p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <ShieldCheck
                  size={20}
                  className="mt-0.5 shrink-0 text-[#D9B978]"
                />
                <div>
                  <p className="text-sm font-semibold text-[#E6C98E]">
                    Data integrity & dataset disclosure
                  </p>
                  <p className="mt-2 max-w-4xl text-xs leading-6 text-[#A39A89]">
                    {isSynthetic
                      ? "This dashboard is currently using the Janus AI synthetic demonstration dataset. Supplier names, procurement values, delivery statistics and performance indicators are simulated and do not represent verified GUVNL supplier records or actual operational performance."
                      : "This dashboard is currently using an uploaded dataset. Supplier performance indicators and procurement values are calculated from the uploaded records and depend on the completeness and accuracy of the supplied data. They should not be treated as independently verified GUVNL operational records."}
                  </p>
                </div>
              </div>
            </section>
          </>
        )}

        <footer className="mt-10 flex flex-col justify-between gap-3 border-t border-[#29251F] pt-5 text-[10px] text-[#69645B] sm:flex-row sm:items-center">
          <p>Janus AI · SUPPLIER INTELLIGENCE</p>
          <p>AI-POWERED MATERIAL DEMAND & INVENTORY OPTIMIZATION</p>
        </footer>
      </main>
    </div>
  );
}