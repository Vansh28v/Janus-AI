"use client";

import { useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Boxes,
  BrainCircuit,
  Package,
  RefreshCw,
  ShieldAlert,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import ActiveDataSource from "@/components/active-data-source";

// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------

type Overview = {
  latest_week: string;
  total_materials: number;
  total_locations: number;
  tracked_combinations: number;
  low_stock_combinations: number;
  latest_unmet_demand_combinations: number;
  historical_stockout_weeks: number;
  purchase_orders_total: number;
  purchase_orders_received: number;
  purchase_orders_outstanding: number;
  purchase_orders_delayed: number;
  purchase_orders_emergency: number;
  source: string;
};

type StockRecord = {
  week_start: string;
  item_code: string;
  location_code: string;
  opening_stock: number;
  received_quantity: number;
  requested_quantity: number;
  issued_quantity: number;
  unmet_quantity: number;
  outstanding_quantity: number;
  overdue_quantity: number;
  dependable_pipeline_quantity: number;
  inventory_position: number;
  closing_stock: number;
  reorder_point: number;
  target_stock: number;
  stock_cover_days: number;
  days_until_next_delivery: number;
  projected_shortage_before_delivery: number;
  ordered_quantity: number;
  emergency_replenishment: number;
  unit: string;
  source: string;
};

type AlertRecord = StockRecord & {
  alert_types: string[];
};

type PurchaseOrder = {
  po_id: string;
  order_date: string;
  expected_arrival_date: string;
  actual_arrival_date: string;
  item_code: string;
  location_code: string;
  supplier_code: string;
  ordered_quantity: number;
  expected_lead_time_days: number;
  actual_lead_time_days: number;
  is_delayed: boolean;
  is_emergency: boolean;
  status: string;
  unit_cost: number;
  total_cost: number;
  source: string;
};

type WeeklyRecord = {
  week_start: string;
  item_code: string;
  location_code: string;
  received_quantity: number;
  issued_quantity: number;
  unmet_quantity: number;
};

type OptimizationRecommendation = {
  item_code: string;
  unit: string;
  recommendation_type: "REDISTRIBUTION" | "PROCUREMENT";
  priority: "CRITICAL" | "HIGH" | "MEDIUM";
  from_location: string | null;
  to_location: string;
  recommended_quantity: number;
  reason: string;
  source: string;
};

type OptimizationData = {
  latest_week: string;
  source: string;
  total_recommendations: number;
  redistribution_recommendations: number;
  procurement_recommendations: number;
  total_redistribution_quantity: number;
  total_procurement_quantity: number;
  priority_counts: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
  };
  recommendations: OptimizationRecommendation[];
};

type ApiList<T> = {
  total_records?: number;
  returned_records?: number;
  total_alerts?: number;
  records: T[];
};

const API_URL = "http://localhost:8000";

// ------------------------------------------------------------
// FORMATTERS
// ------------------------------------------------------------

const number = (value: number | null | undefined) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 1,
  }).format(Number(value ?? 0));

const currency = (value: number | null | undefined) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

const dateLabel = (value: string | null | undefined) => {
  if (!value) return "—";

  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const shortDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
};

// ------------------------------------------------------------
// SMALL UI COMPONENTS
// ------------------------------------------------------------

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[2.5px] text-[#C9A362]">
        {eyebrow}
      </p>
      <h2 className="text-lg font-semibold tracking-tight text-[#F1E8D8]">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-xs text-[#8F887D]">{description}</p>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  warning = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ElementType;
  warning?: boolean;
}) {
  return (
    <div className="rounded-sm border border-[#C9A362]/15 bg-[#10100F] p-5 transition hover:border-[#C9A362]/35">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-[1.8px] text-[#938A7B]">
          {label}
        </p>
        <div
          className={`rounded-sm border p-2 ${
            warning
              ? "border-red-400/20 bg-red-400/10 text-red-300"
              : "border-[#C9A362]/20 bg-[#C9A362]/10 text-[#E6C98E]"
          }`}
        >
          <Icon size={16} />
        </div>
      </div>

      <p className="text-3xl font-semibold tracking-tight text-[#F1E8D8]">
        {value}
      </p>
      <p className="mt-2 text-[11px] text-[#81796E]">{detail}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toUpperCase();

  const styles: Record<string, string> = {
    RECEIVED: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    OUTSTANDING: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    CANCELLED: "border-red-400/20 bg-red-400/10 text-red-300",
  };

  return (
    <span
      className={`inline-flex rounded-sm border px-2 py-1 text-[9px] font-semibold tracking-wide ${
        styles[normalized] ??
        "border-white/10 bg-white/5 text-[#B8B0A3]"
      }`}
    >
      {normalized}
    </span>
  );
}

// ------------------------------------------------------------
// MAIN PAGE
// ------------------------------------------------------------

export default function InventoryPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [stock, setStock] = useState<StockRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [weekly, setWeekly] = useState<WeeklyRecord[]>([]);
  const [optimization, setOptimization] =
    useState<OptimizationData | null>(null);
  const [optimizationError, setOptimizationError] = useState("");
  const [selectedRecommendationType, setSelectedRecommendationType] =
    useState("ALL");

  const [selectedItem, setSelectedItem] = useState("ALL");
  const [selectedLocation, setSelectedLocation] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadInventory() {
    setLoading(true);
    setError("");

    try {
      const [
        overviewResponse,
        stockResponse,
        alertsResponse,
        purchaseResponse,
        weeklyResponse,
      ] = await Promise.all([
        fetch(`${API_URL}/api/inventory/overview`),
        fetch(`${API_URL}/api/inventory/stock?limit=5000`),
        fetch(`${API_URL}/api/inventory/alerts?limit=5000`),
        fetch(`${API_URL}/api/inventory/purchase-orders?limit=5000`),
        fetch(`${API_URL}/api/inventory/weekly?limit=20000`),
      ]);

      const responses = [
        overviewResponse,
        stockResponse,
        alertsResponse,
        purchaseResponse,
        weeklyResponse,
      ];

      const failed = responses.find((response) => !response.ok);

      if (failed) {
        throw new Error(`Inventory API returned ${failed.status}`);
      }

      const [
        overviewData,
        stockData,
        alertData,
        purchaseData,
        weeklyData,
      ] = await Promise.all([
        overviewResponse.json() as Promise<Overview>,
        stockResponse.json() as Promise<ApiList<StockRecord>>,
        alertsResponse.json() as Promise<ApiList<AlertRecord>>,
        purchaseResponse.json() as Promise<ApiList<PurchaseOrder>>,
        weeklyResponse.json() as Promise<ApiList<WeeklyRecord>>,
      ]);

      if (
        !Array.isArray(stockData.records) ||
        !Array.isArray(alertData.records) ||
        !Array.isArray(purchaseData.records) ||
        !Array.isArray(weeklyData.records)
      ) {
        throw new Error("Unexpected inventory API response format.");
      }

      setOverview(overviewData);
      setStock(stockData.records);
      setAlerts(alertData.records);
      setPurchaseOrders(purchaseData.records);
      setWeekly(weeklyData.records);

      // Load optimization recommendations independently so an optimization
      // endpoint issue does not prevent the rest of the inventory page loading.
      setOptimizationError("");

      try {
        const optimizationResponse = await fetch(
          `${API_URL}/api/inventory/optimization`
        );

        if (!optimizationResponse.ok) {
          throw new Error(
            `Optimization API returned ${optimizationResponse.status}`
          );
        }

        const rawOptimization = (await optimizationResponse.json()) as {
          latest_week?: string;
          source?: string;
          total_recommendations?: number;
          redistribution_recommendations?: number;
          procurement_recommendations?: number;
          total_redistribution_quantity?: number;
          total_procurement_quantity?: number;
          priority_counts?: {
            CRITICAL?: number;
            HIGH?: number;
            MEDIUM?: number;
          };
          recommendations?: Array<{
            item_code?: string;
            unit?: string;
            recommendation_type?: "REDISTRIBUTION" | "PROCUREMENT";
            priority?: "CRITICAL" | "HIGH" | "MEDIUM";
            from_location?: string | null;
            to_location?: string;
            recommended_quantity?: number;
            reason?: string;
            source?: string;
          }>;
        };

        if (!Array.isArray(rawOptimization.recommendations)) {
          throw new Error(
            "Optimization API returned an invalid recommendations list."
          );
        }

        // Some backend versions do not include unit or priority_counts.
        // Derive those fields safely from the stock snapshot and returned rows.
        const normalizedRecommendations: OptimizationRecommendation[] =
          rawOptimization.recommendations.map((record) => {
            const stockRecord = stockData.records.find(
              (stockItem) => stockItem.item_code === record.item_code
            );

            return {
              item_code: record.item_code ?? "UNKNOWN",
              unit: record.unit || stockRecord?.unit || "—",
              recommendation_type:
                record.recommendation_type === "REDISTRIBUTION"
                  ? "REDISTRIBUTION"
                  : "PROCUREMENT",
              priority:
                record.priority === "CRITICAL" ||
                record.priority === "MEDIUM"
                  ? record.priority
                  : "HIGH",
              from_location: record.from_location ?? null,
              to_location: record.to_location ?? "—",
              recommended_quantity: Number(
                record.recommended_quantity ?? 0
              ),
              reason: record.reason ?? "No reason supplied.",
              source: record.source ?? rawOptimization.source ?? "SYNTHETIC",
            };
          });

        const calculatedPriorityCounts = {
          CRITICAL: normalizedRecommendations.filter(
            (record) => record.priority === "CRITICAL"
          ).length,
          HIGH: normalizedRecommendations.filter(
            (record) => record.priority === "HIGH"
          ).length,
          MEDIUM: normalizedRecommendations.filter(
            (record) => record.priority === "MEDIUM"
          ).length,
        };

        const normalizedOptimization: OptimizationData = {
          latest_week:
            rawOptimization.latest_week ?? overviewData.latest_week,
          source: rawOptimization.source ?? "SYNTHETIC",
          total_recommendations:
            Number(
              rawOptimization.total_recommendations ??
                normalizedRecommendations.length
            ),
          redistribution_recommendations:
            Number(
              rawOptimization.redistribution_recommendations ??
                normalizedRecommendations.filter(
                  (record) =>
                    record.recommendation_type === "REDISTRIBUTION"
                ).length
            ),
          procurement_recommendations:
            Number(
              rawOptimization.procurement_recommendations ??
                normalizedRecommendations.filter(
                  (record) => record.recommendation_type === "PROCUREMENT"
                ).length
            ),
          total_redistribution_quantity:
            Number(
              rawOptimization.total_redistribution_quantity ??
                normalizedRecommendations
                  .filter(
                    (record) =>
                      record.recommendation_type === "REDISTRIBUTION"
                  )
                  .reduce(
                    (total, record) =>
                      total + record.recommended_quantity,
                    0
                  )
            ),
          total_procurement_quantity:
            Number(
              rawOptimization.total_procurement_quantity ??
                normalizedRecommendations
                  .filter(
                    (record) => record.recommendation_type === "PROCUREMENT"
                  )
                  .reduce(
                    (total, record) =>
                      total + record.recommended_quantity,
                    0
                  )
            ),
          priority_counts: {
            CRITICAL: Number(
              rawOptimization.priority_counts?.CRITICAL ??
                calculatedPriorityCounts.CRITICAL
            ),
            HIGH: Number(
              rawOptimization.priority_counts?.HIGH ??
                calculatedPriorityCounts.HIGH
            ),
            MEDIUM: Number(
              rawOptimization.priority_counts?.MEDIUM ??
                calculatedPriorityCounts.MEDIUM
            ),
          },
          recommendations: normalizedRecommendations,
        };

        setOptimization(normalizedOptimization);
        setOptimizationError("");
      } catch (optimizationErr) {
        setOptimization(null);
        setOptimizationError(
          optimizationErr instanceof Error
            ? optimizationErr.message
            : "Unable to load optimization recommendations."
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load inventory data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInventory();
  }, []);

  // ----------------------------------------------------------
  // FILTERS
  // ----------------------------------------------------------

  const materials = useMemo(
    () => [...new Set(stock.map((record) => record.item_code))].sort(),
    [stock]
  );

  const locations = useMemo(
    () => [...new Set(stock.map((record) => record.location_code))].sort(),
    [stock]
  );

  const filteredStock = useMemo(
    () =>
      stock.filter(
        (record) =>
          (selectedItem === "ALL" ||
            record.item_code === selectedItem) &&
          (selectedLocation === "ALL" ||
            record.location_code === selectedLocation)
      ),
    [stock, selectedItem, selectedLocation]
  );

  const filteredAlerts = useMemo(
    () =>
      alerts.filter(
        (record) =>
          (selectedItem === "ALL" ||
            record.item_code === selectedItem) &&
          (selectedLocation === "ALL" ||
            record.location_code === selectedLocation)
      ),
    [alerts, selectedItem, selectedLocation]
  );

  const filteredOrders = useMemo(
    () =>
      purchaseOrders.filter(
        (record) =>
          (selectedItem === "ALL" ||
            record.item_code === selectedItem) &&
          (selectedLocation === "ALL" ||
            record.location_code === selectedLocation)
      ),
    [purchaseOrders, selectedItem, selectedLocation]
  );

  const filteredRecommendations = useMemo(
    () =>
      (optimization?.recommendations ?? []).filter((record) => {
        const matchesItem =
          selectedItem === "ALL" ||
          record.item_code === selectedItem;

        const matchesLocation =
          selectedLocation === "ALL" ||
          record.from_location === selectedLocation ||
          record.to_location === selectedLocation;

        const matchesType =
          selectedRecommendationType === "ALL" ||
          record.recommendation_type === selectedRecommendationType;

        return matchesItem && matchesLocation && matchesType;
      }),
    [
      optimization,
      selectedItem,
      selectedLocation,
      selectedRecommendationType,
    ]
  );

  // ----------------------------------------------------------
  // MOVEMENT CHART — LAST 12 WEEKS
  // ----------------------------------------------------------

  const movementChart = useMemo(() => {
    const totals = new Map<
      string,
      { week: string; received: number; issued: number }
    >();

    weekly.forEach((record) => {
      const current = totals.get(record.week_start) ?? {
        week: record.week_start,
        received: 0,
        issued: 0,
      };

      current.received += Number(record.received_quantity ?? 0);
      current.issued += Number(record.issued_quantity ?? 0);

      totals.set(record.week_start, current);
    });

    return [...totals.values()]
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-12)
      .map((record) => ({
        ...record,
        label: shortDate(record.week),
      }));
  }, [weekly]);

  // ----------------------------------------------------------
  // DERIVED METRICS
  // ----------------------------------------------------------

  const filteredLowStock = filteredStock.filter(
    (record) => record.closing_stock <= record.reorder_point
  ).length;

  const filteredUnmet = filteredStock.filter(
    (record) => record.unmet_quantity > 0
  ).length;

  const outstandingOrders = filteredOrders.filter(
    (record) => record.status?.toUpperCase() === "OUTSTANDING"
  ).length;

  const delayedOrders = filteredOrders.filter(
    (record) => record.is_delayed
  ).length;

  const emergencyOrders = filteredOrders.filter(
    (record) => record.is_emergency
  ).length;

  const latestWeek =
    overview?.latest_week ?? stock[0]?.week_start ?? "";

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  return (
    <main className="min-h-screen bg-[#080807] text-[#F1E8D8]">
      {/* SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[250px] border-r border-[#C9A362]/15 bg-[#050505] lg:flex lg:flex-col">
        <div className="flex h-[82px] items-center border-b border-[#C9A362]/15 px-7">
          <Link
            href="/"
            className="text-[23px] font-bold tracking-[-1.3px]"
          >
            GRID<span className="text-[#E6C98E]">STOCK</span>
            <span className="ml-2 text-[9px] font-medium tracking-[2px] text-[#8F826D]">
              AI
            </span>
          </Link>
        </div>

        <div className="px-5 py-7">
          <p className="mb-4 px-3 text-[9px] font-semibold uppercase tracking-[2px] text-[#71695E]">
            Intelligence
          </p>

          <nav className="space-y-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-sm px-3 py-3 text-[12px] text-[#9D9588] transition hover:bg-white/5 hover:text-[#E6C98E]"
            >
              <Activity size={16} />
              Intelligence Overview
            </Link>

            <Link
              href="/dashboard/forecasting"
              className="flex items-center gap-3 rounded-sm px-3 py-3 text-[12px] text-[#9D9588] transition hover:bg-white/5 hover:text-[#E6C98E]"
            >
              <BrainCircuit size={16} />
              Demand Forecasting
            </Link>

            <Link
              href="/dashboard/inventory"
              className="flex items-center gap-3 rounded-sm border border-[#C9A362]/20 bg-[#C9A362]/10 px-3 py-3 text-[12px] text-[#E6C98E]"
            >
              <Boxes size={16} />
              Inventory Intelligence
            </Link>

            <Link
              href="/dashboard/suppliers"
              className="flex items-center gap-3 rounded-sm px-3 py-3 text-[12px] text-[#9D9588] transition hover:bg-white/5 hover:text-[#E6C98E]"
            >
              <Users size={16} />
              Supplier Intelligence
            </Link>
          </nav>
        </div>

        <div className="mt-auto border-t border-[#C9A362]/15 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-[#C9A362]/20 bg-[#C9A362]/10 text-[#E6C98E]">
              <Warehouse size={15} />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#D8CDBB]">
                Janus AI
              </p>
              <p className="mt-1 text-[9px] text-[#746D62]">
                Utility intelligence platform
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="lg:pl-[250px]">
        {/* TOP BAR */}
        <header className="sticky top-0 z-20 flex min-h-[76px] items-center justify-between border-b border-[#C9A362]/15 bg-[#080807]/95 px-5 backdrop-blur-xl md:px-9">
          <div>
            <div className="flex items-center gap-2 text-[10px] text-[#8F887D]">
              <Link
                href="/dashboard"
                className="transition hover:text-[#E6C98E]"
              >
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-[#E6C98E]">Inventory Intelligence</span>
            </div>
            <h1 className="mt-1 text-sm font-semibold tracking-wide text-[#F1E8D8]">
              Inventory Intelligence
            </h1>
          </div>

          <button
            onClick={loadInventory}
            disabled={loading}
            className="flex items-center gap-2 rounded-sm border border-[#C9A362]/25 px-3 py-2 text-[10px] font-medium text-[#DCC89F] transition hover:bg-[#C9A362]/10 disabled:opacity-50"
          >
            <RefreshCw
              size={13}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </header>

        <div className="mx-auto max-w-[1600px] space-y-9 px-5 py-8 md:px-9 md:py-10">
          {/* PAGE INTRO */}
          <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-[1px] w-7 bg-[#C9A362]" />
                <span className="text-[9px] font-semibold uppercase tracking-[3px] text-[#C9A362]">
                  Supply chain control
                </span>
              </div>

              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Inventory <span className="text-[#E6C98E]">Intelligence.</span>
              </h2>

              <p className="mt-3 max-w-2xl text-xs leading-6 text-[#968E81]">
                Monitor material availability, identify stock risks and track
                procurement activity across utility locations.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-sm border border-[#C9A362]/20 bg-[#C9A362]/5 px-4 py-3">
                <p className="text-[9px] uppercase tracking-[1.8px] text-[#8F887D]">
                  Latest data week
                </p>
                <p className="mt-1 text-xs font-semibold text-[#E6C98E]">
                  {latestWeek ? dateLabel(latestWeek) : "—"}
                </p>
              </div>

              <ActiveDataSource workspace="inventory" />
            </div>
          </section>

          {/* ERROR */}
          {error && (
            <div className="flex items-start gap-3 rounded-sm border border-red-400/25 bg-red-400/5 p-4">
              <AlertTriangle
                size={17}
                className="mt-0.5 shrink-0 text-red-300"
              />
              <div>
                <p className="text-xs font-semibold text-red-200">
                  Unable to load inventory data
                </p>
                <p className="mt-1 text-[11px] text-red-200/70">{error}</p>
                <button
                  onClick={loadInventory}
                  className="mt-3 text-[10px] font-semibold text-[#E6C98E] underline underline-offset-4"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* LOADING */}
          {loading && !overview && (
            <div className="rounded-sm border border-[#C9A362]/15 bg-[#10100F] px-6 py-16 text-center">
              <RefreshCw
                size={22}
                className="mx-auto animate-spin text-[#E6C98E]"
              />
              <p className="mt-4 text-xs text-[#A69A85]">
                Loading inventory intelligence...
              </p>
            </div>
          )}

          {/* DASHBOARD CONTENT */}
          {overview && (
            <>
              {/* FILTERS */}
              <section className="flex flex-col gap-3 rounded-sm border border-[#C9A362]/15 bg-[#10100F] p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[1.8px] text-[#DCC89F]">
                    Inventory filters
                  </p>
                  <p className="mt-1 text-[10px] text-[#81796E]">
                    Filter stock, alerts and purchase orders.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <select
                    value={selectedItem}
                    onChange={(event) => setSelectedItem(event.target.value)}
                    className="min-w-[180px] rounded-sm border border-[#C9A362]/20 bg-[#080807] px-3 py-2.5 text-[11px] text-[#E8DDCA] outline-none focus:border-[#C9A362]/60"
                  >
                    <option value="ALL">All materials</option>
                    {materials.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedLocation}
                    onChange={(event) =>
                      setSelectedLocation(event.target.value)
                    }
                    className="min-w-[180px] rounded-sm border border-[#C9A362]/20 bg-[#080807] px-3 py-2.5 text-[11px] text-[#E8DDCA] outline-none focus:border-[#C9A362]/60"
                  >
                    <option value="ALL">All locations</option>
                    {locations.map((location) => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => {
                      setSelectedItem("ALL");
                      setSelectedLocation("ALL");
                    }}
                    className="rounded-sm border border-white/10 px-3 py-2 text-[10px] text-[#A69A85] transition hover:border-[#C9A362]/40 hover:text-[#E6C98E]"
                  >
                    Clear filters
                  </button>
                </div>
              </section>

              {/* KPI CARDS */}
              <section>
                <SectionHeading
                  eyebrow="Inventory overview"
                  title="Material availability at a glance"
                  description="Portfolio-level figures are based on the latest generated inventory snapshot."
                />

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label="Tracked materials"
                    value={number(overview.total_materials)}
                    detail={`${number(overview.total_locations)} utility locations`}
                    icon={Package}
                  />

                  <MetricCard
                    label="Low-stock combinations"
                    value={number(
                      selectedItem === "ALL" &&
                        selectedLocation === "ALL"
                        ? overview.low_stock_combinations
                        : filteredLowStock
                    )}
                    detail={`${number(filteredStock.length)} filtered combinations`}
                    icon={AlertTriangle}
                    warning
                  />

                  <MetricCard
                    label="Unmet demand combinations"
                    value={number(
                      selectedItem === "ALL" &&
                        selectedLocation === "ALL"
                        ? overview.latest_unmet_demand_combinations
                        : filteredUnmet
                    )}
                    detail="Latest data week"
                    icon={ShieldAlert}
                    warning
                  />

                  <MetricCard
                    label="Outstanding purchase orders"
                    value={number(
                      selectedItem === "ALL" &&
                        selectedLocation === "ALL"
                        ? overview.purchase_orders_outstanding
                        : outstandingOrders
                    )}
                    detail="Orders not yet received"
                    icon={Truck}
                  />
                </div>
              </section>

              {/* INVENTORY OPTIMIZATION */}
              <section>
                <SectionHeading
                  eyebrow="Decision intelligence"
                  title="Inventory optimization"
                  description="Redistribute available surplus before recommending new procurement."
                />

                {optimizationError && (
                  <div className="mb-4 rounded-sm border border-red-400/20 bg-red-400/5 p-4">
                    <p className="text-xs font-semibold text-red-300">
                      Optimization data unavailable
                    </p>
                    <p className="mt-1 text-[10px] text-red-200/70">
                      {optimizationError}
                    </p>
                  </div>
                )}

                {!optimization && !optimizationError && (
                  <div className="rounded-sm border border-[#C9A362]/15 bg-[#10100F] p-8 text-center">
                    <RefreshCw
                      size={20}
                      className="mx-auto animate-spin text-[#E6C98E]"
                    />
                    <p className="mt-3 text-xs text-[#A69A85]">
                      Loading optimization recommendations...
                    </p>
                  </div>
                )}

                {optimization && (
                  <>
                    {/* OPTIMIZATION SUMMARY */}
                    <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <MetricCard
                        label="Total recommendations"
                        value={number(optimization.total_recommendations)}
                        detail="Current optimization snapshot"
                        icon={BrainCircuit}
                      />

                      <MetricCard
                        label="Redistribution actions"
                        value={number(
                          optimization.redistribution_recommendations
                        )}
                        detail={`${number(
                          optimization.total_redistribution_quantity
                        )} units / meters / kits`}
                        icon={Boxes}
                      />

                      <MetricCard
                        label="Procurement actions"
                        value={number(
                          optimization.procurement_recommendations
                        )}
                        detail={`${number(
                          optimization.total_procurement_quantity
                        )} units / meters / kits`}
                        icon={Truck}
                      />

                      <MetricCard
                        label="Critical recommendations"
                        value={number(
                          optimization.priority_counts.CRITICAL
                        )}
                        detail={`${number(
                          optimization.priority_counts.HIGH
                        )} high · ${number(
                          optimization.priority_counts.MEDIUM
                        )} medium`}
                        icon={ShieldAlert}
                        warning={
                          optimization.priority_counts.CRITICAL > 0
                        }
                      />
                    </div>

                    {/* PRIORITY AND FILTERS */}
                    <div className="mb-4 flex flex-col justify-between gap-4 rounded-sm border border-[#C9A362]/15 bg-[#10100F] p-4 md:flex-row md:items-center">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[1.8px] text-[#DCC89F]">
                          Recommendation priority
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {[
                            {
                              label: "Critical",
                              count: optimization.priority_counts.CRITICAL,
                              style:
                                "border-red-400/20 bg-red-400/10 text-red-300",
                            },
                            {
                              label: "High",
                              count: optimization.priority_counts.HIGH,
                              style:
                                "border-amber-400/20 bg-amber-400/10 text-amber-300",
                            },
                            {
                              label: "Medium",
                              count: optimization.priority_counts.MEDIUM,
                              style:
                                "border-blue-400/20 bg-blue-400/10 text-blue-300",
                            },
                          ].map((priority) => (
                            <span
                              key={priority.label}
                              className={`rounded-sm border px-3 py-2 text-[10px] font-semibold ${priority.style}`}
                            >
                              {priority.label}: {number(priority.count)}
                            </span>
                          ))}
                        </div>
                      </div>

                      <select
                        value={selectedRecommendationType}
                        onChange={(event) =>
                          setSelectedRecommendationType(event.target.value)
                        }
                        className="min-w-[190px] rounded-sm border border-[#C9A362]/20 bg-[#080807] px-3 py-2.5 text-[11px] text-[#E8DDCA] outline-none focus:border-[#C9A362]/60"
                      >
                        <option value="ALL">All recommendations</option>
                        <option value="REDISTRIBUTION">
                          Redistribution only
                        </option>
                        <option value="PROCUREMENT">Procurement only</option>
                      </select>
                    </div>

                    {/* RECOMMENDATION TABLE */}
                    <div className="overflow-hidden rounded-sm border border-[#C9A362]/15 bg-[#10100F]">
                      <div className="flex items-center justify-between border-b border-[#C9A362]/15 px-5 py-4">
                        <div>
                          <p className="text-xs font-semibold text-[#E8DDCA]">
                            Recommended inventory actions
                          </p>
                          <p className="mt-1 text-[10px] text-[#81796E]">
                            {filteredRecommendations.length} matching
                            recommendations
                          </p>
                        </div>

                        <BrainCircuit
                          size={17}
                          className="text-[#C9A362]"
                        />
                      </div>

                      <div className="max-h-[520px] overflow-auto">
                        <table className="w-full min-w-[1050px] text-left">
                          <thead className="sticky top-0 z-10 bg-[#171613]">
                            <tr className="text-[9px] uppercase tracking-[1.3px] text-[#8F887D]">
                              <th className="px-5 py-3 font-medium">
                                Material
                              </th>
                              <th className="px-4 py-3 font-medium">
                                Action
                              </th>
                              <th className="px-4 py-3 font-medium">From</th>
                              <th className="px-4 py-3 font-medium">
                                Destination
                              </th>
                              <th className="px-4 py-3 text-right font-medium">
                                Quantity
                              </th>
                              <th className="px-4 py-3 font-medium">
                                Priority
                              </th>
                              <th className="px-5 py-3 font-medium">
                                Reason
                              </th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-white/5">
                            {filteredRecommendations.map((record, index) => (
                              <tr
                                key={`${record.item_code}-${record.recommendation_type}-${record.from_location ?? "new"}-${record.to_location}-${index}`}
                                className="transition hover:bg-white/[0.025]"
                              >
                                <td className="px-5 py-3.5">
                                  <p className="text-[11px] font-semibold text-[#E8DDCA]">
                                    {record.item_code}
                                  </p>
                                  <p className="mt-1 text-[9px] text-[#71695E]">
                                    {record.unit}
                                  </p>
                                </td>

                                <td className="px-4 py-3.5">
                                  <span
                                    className={`rounded-sm border px-2 py-1 text-[8px] font-semibold ${
                                      record.recommendation_type ===
                                      "REDISTRIBUTION"
                                        ? "border-blue-400/20 bg-blue-400/10 text-blue-300"
                                        : "border-[#C9A362]/20 bg-[#C9A362]/10 text-[#E6C98E]"
                                    }`}
                                  >
                                    {record.recommendation_type ===
                                    "REDISTRIBUTION"
                                      ? "TRANSFER"
                                      : "PROCUREMENT"}
                                  </span>
                                </td>

                                <td className="px-4 py-3.5 text-[10px] text-[#B5AA98]">
                                  {record.from_location ?? "External supplier"}
                                </td>

                                <td className="px-4 py-3.5 text-[10px] text-[#B5AA98]">
                                  {record.to_location}
                                </td>

                                <td className="px-4 py-3.5 text-right text-[11px] font-semibold tabular-nums text-[#E8DDCA]">
                                  {number(record.recommended_quantity)}
                                </td>

                                <td className="px-4 py-3.5">
                                  <span
                                    className={`rounded-sm border px-2 py-1 text-[8px] font-semibold ${
                                      record.priority === "CRITICAL"
                                        ? "border-red-400/20 bg-red-400/10 text-red-300"
                                        : record.priority === "HIGH"
                                          ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
                                          : "border-blue-400/20 bg-blue-400/10 text-blue-300"
                                    }`}
                                  >
                                    {record.priority}
                                  </span>
                                </td>

                                <td className="max-w-[260px] px-5 py-3.5 text-[10px] leading-5 text-[#968E81]">
                                  {record.reason}
                                </td>
                              </tr>
                            ))}

                            {filteredRecommendations.length === 0 && (
                              <tr>
                                <td
                                  colSpan={7}
                                  className="px-5 py-12 text-center text-xs text-[#81796E]"
                                >
                                  No recommendations match these filters.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <p className="mt-3 text-[9px] leading-5 text-[#71695E]">
                      Recommendations are generated by a rule-based
                      optimization engine using the active dataset.
                      Redistribution is prioritized before procurement.
                      These are decision-support suggestions, not executed
                      stock transfers or purchase orders.
                    </p>
                  </>
                )}
              </section>
                            {/* STOCK HEALTH TABLE */}
              <section>
                <SectionHeading
                  eyebrow="Stock monitoring"
                  title="Material stock health"
                  description="Compare closing stock against reorder levels and target inventory."
                />

                <div className="overflow-hidden rounded-sm border border-[#C9A362]/15 bg-[#10100F]">
                  <div className="flex items-center justify-between border-b border-[#C9A362]/15 px-5 py-4">
                    <div>
                      <p className="text-xs font-semibold text-[#E8DDCA]">
                        Stock position by location
                      </p>
                      <p className="mt-1 text-[10px] text-[#81796E]">
                        {filteredStock.length} material-location records
                      </p>
                    </div>
                    <Boxes size={17} className="text-[#C9A362]" />
                  </div>

                  <div className="max-h-[470px] overflow-auto">
                    <table className="w-full min-w-[850px] text-left">
                      <thead className="sticky top-0 z-10 bg-[#171613]">
                        <tr className="text-[9px] uppercase tracking-[1.3px] text-[#8F887D]">
                          <th className="px-5 py-3 font-medium">Material</th>
                          <th className="px-4 py-3 font-medium">Location</th>
                          <th className="px-4 py-3 text-right font-medium">
                            Closing stock
                          </th>
                          <th className="px-4 py-3 text-right font-medium">
                            Reorder point
                          </th>
                          <th className="px-4 py-3 text-right font-medium">
                            Target stock
                          </th>
                          <th className="px-4 py-3 text-right font-medium">
                            Cover days
                          </th>
                          <th className="px-5 py-3 text-right font-medium">
                            Status
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-white/5">
                        {filteredStock.map((record, index) => {
                          const low =
                            record.closing_stock <= record.reorder_point;

                          return (
                            <tr
                              key={`${record.item_code}-${record.location_code}-${index}`}
                              className="transition hover:bg-white/[0.025]"
                            >
                              <td className="px-5 py-3.5">
                                <p className="text-[11px] font-semibold text-[#E8DDCA]">
                                  {record.item_code}
                                </p>
                                <p className="mt-1 text-[9px] text-[#71695E]">
                                  {record.unit}
                                </p>
                              </td>

                              <td className="px-4 py-3.5 text-[10px] text-[#B5AA98]">
                                {record.location_code}
                              </td>

                              <td className="px-4 py-3.5 text-right text-[11px] font-semibold tabular-nums text-[#E8DDCA]">
                                {number(record.closing_stock)}
                              </td>

                              <td className="px-4 py-3.5 text-right text-[11px] tabular-nums text-[#A69A85]">
                                {number(record.reorder_point)}
                              </td>

                              <td className="px-4 py-3.5 text-right text-[11px] tabular-nums text-[#A69A85]">
                                {number(record.target_stock)}
                              </td>

                              <td className="px-4 py-3.5 text-right text-[11px] tabular-nums text-[#A69A85]">
                                {number(record.stock_cover_days)}
                              </td>

                              <td className="px-5 py-3.5 text-right">
                                <span
                                  className={`rounded-sm border px-2 py-1 text-[9px] font-semibold ${
                                    low
                                      ? "border-red-400/20 bg-red-400/10 text-red-300"
                                      : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                                  }`}
                                >
                                  {low ? "LOW STOCK" : "HEALTHY"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}

                        {filteredStock.length === 0 && (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-5 py-12 text-center text-xs text-[#81796E]"
                            >
                              No stock records match these filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* STOCK MOVEMENTS */}
              <section>
                <SectionHeading
                  eyebrow="Inventory movement"
                  title="Receipts vs material issues"
                  description="Weekly quantities received and issued across the active inventory dataset."
                />

                <div className="rounded-sm border border-[#C9A362]/15 bg-[#10100F] p-5">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-[#E8DDCA]">
                        Weekly movement trend
                      </p>
                      <p className="mt-1 text-[10px] text-[#81796E]">
                        Last 12 available data weeks
                      </p>
                    </div>
                    <div className="flex gap-4 text-[10px]">
                      <span className="flex items-center gap-2 text-[#E6C98E]">
                        <span className="h-2 w-2 rounded-full bg-[#E6C98E]" />
                        Receipts
                      </span>
                      <span className="flex items-center gap-2 text-[#8C9EAC]">
                        <span className="h-2 w-2 rounded-full bg-[#8C9EAC]" />
                        Issues
                      </span>
                    </div>
                  </div>

                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={movementChart}
                        margin={{
                          top: 10,
                          right: 10,
                          left: -15,
                          bottom: 0,
                        }}
                      >
                        <defs>
                          <linearGradient
                            id="receiptGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#E6C98E"
                              stopOpacity={0.25}
                            />
                            <stop
                              offset="100%"
                              stopColor="#E6C98E"
                              stopOpacity={0}
                            />
                          </linearGradient>

                          <linearGradient
                            id="issueGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#8C9EAC"
                              stopOpacity={0.2}
                            />
                            <stop
                              offset="100%"
                              stopColor="#8C9EAC"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>

                        <CartesianGrid
                          stroke="#FFFFFF"
                          strokeOpacity={0.06}
                          vertical={false}
                        />

                        <XAxis
                          dataKey="label"
                          tick={{
                            fill: "#82796D",
                            fontSize: 10,
                          }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <YAxis
                          tick={{
                            fill: "#82796D",
                            fontSize: 10,
                          }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={number}
                        />

                        <Tooltip
                          contentStyle={{
                            background: "#151411",
                            border: "1px solid rgba(201,163,98,0.25)",
                            borderRadius: 2,
                            color: "#F1E8D8",
                            fontSize: 11,
                          }}
                          formatter={(value, name) => [
                            number(Number(value)),
                            name === "received" ? "Receipts" : "Issues",
                          ]}
                          labelStyle={{ color: "#E6C98E" }}
                        />

                        <Legend
                          wrapperStyle={{
                            fontSize: 10,
                            color: "#A69A85",
                          }}
                          formatter={(value) =>
                            value === "received" ? "Receipts" : "Issues"
                          }
                        />

                        <Area
                          type="monotone"
                          dataKey="received"
                          stroke="#E6C98E"
                          strokeWidth={2}
                          fill="url(#receiptGradient)"
                        />

                        <Area
                          type="monotone"
                          dataKey="issued"
                          stroke="#8C9EAC"
                          strokeWidth={2}
                          fill="url(#issueGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>

              {/* ALERTS */}
              <section>
                <SectionHeading
                  eyebrow="Risk monitoring"
                  title="Inventory alerts"
                  description="Material-location combinations requiring attention in the latest data week."
                />

                <div className="overflow-hidden rounded-sm border border-[#C9A362]/15 bg-[#10100F]">
                  <div className="flex items-center justify-between border-b border-[#C9A362]/15 px-5 py-4">
                    <div>
                      <p className="text-xs font-semibold text-[#E8DDCA]">
                        Attention required
                      </p>
                      <p className="mt-1 text-[10px] text-[#81796E]">
                        {filteredAlerts.length} matching alert records
                      </p>
                    </div>
                    <AlertTriangle size={17} className="text-amber-300" />
                  </div>

                  <div className="max-h-[390px] overflow-auto">
                    <table className="w-full min-w-[750px] text-left">
                      <thead className="sticky top-0 bg-[#171613]">
                        <tr className="text-[9px] uppercase tracking-[1.3px] text-[#8F887D]">
                          <th className="px-5 py-3 font-medium">Material</th>
                          <th className="px-4 py-3 font-medium">Location</th>
                          <th className="px-4 py-3 text-right font-medium">
                            Stock
                          </th>
                          <th className="px-4 py-3 text-right font-medium">
                            Unmet demand
                          </th>
                          <th className="px-5 py-3 font-medium">Alert type</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-white/5">
                        {filteredAlerts.slice(0, 100).map((record, index) => (
                          <tr
                            key={`${record.item_code}-${record.location_code}-${index}`}
                            className="hover:bg-white/[0.025]"
                          >
                            <td className="px-5 py-3.5 text-[11px] font-semibold text-[#E8DDCA]">
                              {record.item_code}
                            </td>

                            <td className="px-4 py-3.5 text-[10px] text-[#B5AA98]">
                              {record.location_code}
                            </td>

                            <td className="px-4 py-3.5 text-right text-[11px] tabular-nums text-[#E8DDCA]">
                              {number(record.closing_stock)}
                            </td>

                            <td className="px-4 py-3.5 text-right text-[11px] tabular-nums text-[#E8DDCA]">
                              {number(record.unmet_quantity)}
                            </td>

                            <td className="px-5 py-3.5">
                              <div className="flex flex-wrap gap-1.5">
                                {record.alert_types.map((alert) => (
                                  <span
                                    key={alert}
                                    className={`rounded-sm border px-2 py-1 text-[8px] font-semibold ${
                                      alert === "UNMET_DEMAND"
                                        ? "border-red-400/20 bg-red-400/10 text-red-300"
                                        : "border-amber-400/20 bg-amber-400/10 text-amber-300"
                                    }`}
                                  >
                                    {alert.replaceAll("_", " ")}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}

                        {filteredAlerts.length === 0 && (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-5 py-12 text-center text-xs text-[#81796E]"
                            >
                              No alerts for the selected filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
                            {/* PROCUREMENT */}
              <section>
                <SectionHeading
                  eyebrow="Procurement intelligence"
                  title="Purchase order activity"
                  description="Monitor outstanding, delayed and emergency procurement orders."
                />

                <div className="mb-4 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-sm border border-[#C9A362]/15 bg-[#10100F] p-4">
                    <p className="text-[9px] uppercase tracking-[1.5px] text-[#8F887D]">
                      Outstanding in view
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-amber-200">
                      {number(
                        selectedItem === "ALL" &&
                          selectedLocation === "ALL"
                          ? overview.purchase_orders_outstanding
                          : outstandingOrders
                      )}
                    </p>
                  </div>

                  <div className="rounded-sm border border-[#C9A362]/15 bg-[#10100F] p-4">
                    <p className="text-[9px] uppercase tracking-[1.5px] text-[#8F887D]">
                      Delayed in view
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-red-300">
                      {number(
                        selectedItem === "ALL" &&
                          selectedLocation === "ALL"
                          ? overview.purchase_orders_delayed
                          : delayedOrders
                      )}
                    </p>
                  </div>

                  <div className="rounded-sm border border-[#C9A362]/15 bg-[#10100F] p-4">
                    <p className="text-[9px] uppercase tracking-[1.5px] text-[#8F887D]">
                      Emergency orders in view
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-[#E6C98E]">
                      {number(
                        selectedItem === "ALL" &&
                          selectedLocation === "ALL"
                          ? overview.purchase_orders_emergency
                          : emergencyOrders
                      )}
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-sm border border-[#C9A362]/15 bg-[#10100F]">
                  <div className="flex items-center justify-between border-b border-[#C9A362]/15 px-5 py-4">
                    <div>
                      <p className="text-xs font-semibold text-[#E8DDCA]">
                        Recent purchase orders
                      </p>
                      <p className="mt-1 text-[10px] text-[#81796E]">
                        Showing up to 100 recent records
                      </p>
                    </div>
                    <Truck size={17} className="text-[#C9A362]" />
                  </div>

                  <div className="max-h-[430px] overflow-auto">
                    <table className="w-full min-w-[900px] text-left">
                      <thead className="sticky top-0 bg-[#171613]">
                        <tr className="text-[9px] uppercase tracking-[1.3px] text-[#8F887D]">
                          <th className="px-5 py-3 font-medium">PO ID</th>
                          <th className="px-4 py-3 font-medium">Material</th>
                          <th className="px-4 py-3 font-medium">Location</th>
                          <th className="px-4 py-3 font-medium">Supplier</th>
                          <th className="px-4 py-3 text-right font-medium">
                            Quantity
                          </th>
                          <th className="px-4 py-3 text-right font-medium">
                            Order value
                          </th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-5 py-3 font-medium">Flags</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-white/5">
                        {filteredOrders.slice(0, 100).map((order, index) => (
                          <tr
                            key={`${order.po_id}-${index}`}
                            className="hover:bg-white/[0.025]"
                          >
                            <td className="px-5 py-3.5 text-[10px] font-semibold text-[#DCC89F]">
                              {order.po_id}
                            </td>

                            <td className="px-4 py-3.5 text-[10px] text-[#E8DDCA]">
                              {order.item_code}
                            </td>

                            <td className="px-4 py-3.5 text-[10px] text-[#B5AA98]">
                              {order.location_code}
                            </td>

                            <td className="px-4 py-3.5 text-[10px] text-[#B5AA98]">
                              {order.supplier_code}
                            </td>

                            <td className="px-4 py-3.5 text-right text-[10px] tabular-nums text-[#E8DDCA]">
                              {number(order.ordered_quantity)}
                            </td>

                            <td className="px-4 py-3.5 text-right text-[10px] tabular-nums text-[#E8DDCA]">
                              {currency(order.total_cost)}
                            </td>

                            <td className="px-4 py-3.5">
                              <StatusPill status={order.status} />
                            </td>

                            <td className="px-5 py-3.5">
                              <div className="flex flex-wrap gap-1">
                                {order.is_delayed && (
                                  <span className="rounded-sm border border-red-400/20 bg-red-400/10 px-2 py-1 text-[8px] text-red-300">
                                    DELAYED
                                  </span>
                                )}

                                {order.is_emergency && (
                                  <span className="rounded-sm border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[8px] text-amber-300">
                                    EMERGENCY
                                  </span>
                                )}

                                {!order.is_delayed && !order.is_emergency && (
                                  <span className="text-[9px] text-[#71695E]">
                                    —
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}

                        {filteredOrders.length === 0 && (
                          <tr>
                            <td
                              colSpan={8}
                              className="px-5 py-12 text-center text-xs text-[#81796E]"
                            >
                              No purchase orders match these filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* FOOTNOTE */}
              <footer className="border-t border-[#C9A362]/15 pt-5">
                <div className="flex flex-col justify-between gap-3 text-[9px] text-[#71695E] md:flex-row">
                  <p>
                    Janus AI · Inventory Intelligence · Prototype
                  </p>
                  <p>
                    Figures are sourced from the currently active dataset.
                    Synthetic demo figures are simulated and do not represent
                    actual GUVNL operational records.
                  </p>
                </div>
              </footer>
            </>
          )}
        </div>
      </div>
    </main>
  );
}