"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  Database,
  HardDrive,
  MapPin,
  Package,
  RefreshCw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API = "https://janus-ai-backend-j6bb.onrender.com/api";

const GOLD = "#C9A362";
const CHAMPAGNE = "#E6C98E";
const BLUE = "#91AFC7";
const GREEN = "#8EAD91";
const MUTED = "#938875";

const PIE_COLORS = [GOLD, "#987342", "#6E5738", "#B5A078"];

type AnyRow = Record<string, any>;

function getArray(payload: any): AnyRow[] {
  if (Array.isArray(payload)) return payload;

  for (const key of [
    "records",
    "data",
    "items",
    "results",
    "forecasts",
    "purchase_orders",
    "weekly_inventory",
  ]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }

  return [];
}

function num(value: any): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateLabel(value: string) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function monthLabel(value: string) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 7)}-01T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
  });
}

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function Panel({
  eyebrow,
  title,
  description,
  children,
  className = "",
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 border border-[#C9A362]/15 bg-[#10100F] p-4 sm:p-5 ${className}`}
    >
      <div className="mb-4">
        <p className="text-[9px] font-bold tracking-[1.8px] text-[#A88B58]">
          {eyebrow}
        </p>
        <h3 className="mt-2 text-[14px] font-semibold text-[#EDE1CD]">
          {title}
        </h3>
        <p className="mt-1 text-[9px] leading-5 text-[#8E8577]">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="border border-[#C9A362]/15 bg-[#10100F] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-bold tracking-[1.3px] text-[#A0947E]">
          {label.toUpperCase()}
        </p>
        <span className="text-[#C9A362]">{icon}</span>
      </div>
      <p className="mt-4 text-[25px] font-semibold text-[#F0E5D1]">
        {value}
      </p>
      <p className="mt-2 text-[9px] text-[#8F8576]">{detail}</p>
    </div>
  );
}

const tooltipStyle = {
  background: "#151411",
  border: "1px solid #8D7041",
  borderRadius: 2,
  color: "#F1E8D8",
  fontSize: 10,
};

const axisProps = {
  tick: { fill: MUTED, fontSize: 9 },
  axisLine: false,
  tickLine: false,
};

export default function SyntheticDatasetPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [materials, setMaterials] = useState<AnyRow[]>([]);
  const [forecasts, setForecasts] = useState<AnyRow[]>([]);
  const [weekly, setWeekly] = useState<AnyRow[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<AnyRow[]>([]);

  const [selectedMaterial, setSelectedMaterial] = useState("ALL");
  const [selectedLocation, setSelectedLocation] = useState("ALL");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const endpoints = [
        `${API}/inventory/materials`,
        `${API}/forecasts`,
        `${API}/inventory/weekly`,
        `${API}/inventory/purchase-orders`,
      ];

      const responses = await Promise.all(
        endpoints.map((url) => fetch(url))
      );

      const failed = responses.find((response) => !response.ok);

      if (failed) {
        throw new Error(
          `Unable to retrieve dataset records (HTTP ${failed.status}).`
        );
      }

      const payloads = await Promise.all(
        responses.map((response) => response.json())
      );

      const materialRows = getArray(payloads[0]);
      const forecastRows = getArray(payloads[1]);
      const weeklyRows = getArray(payloads[2]);
      const orderRows = getArray(payloads[3]);

      setMaterials(materialRows);
      setForecasts(forecastRows);
      setWeekly(weeklyRows);
      setPurchaseOrders(orderRows);

      setSelectedMaterial((current) =>
        current === "ALL" || materialRows.some(
          (item) => String(item.item_code) === current
        )
          ? current
          : "ALL"
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dataset analytics."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const materialOptions = useMemo(
    () =>
      materials
        .map((item) => ({
          code: String(item.item_code ?? ""),
          name: String(item.item_name ?? item.item_code ?? "Unknown"),
          unit: String(item.unit ?? ""),
        }))
        .filter((item) => item.code)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [materials]
  );

  const locationOptions = useMemo(
    () =>
      Array.from(
        new Set(
          weekly
            .map((row) => String(row.location_code ?? ""))
            .filter(Boolean)
        )
      ).sort(),
    [weekly]
  );

  const filteredWeekly = useMemo(
    () =>
      weekly.filter((row) => {
        const materialMatches =
          selectedMaterial === "ALL" ||
          String(row.item_code) === selectedMaterial;

        const locationMatches =
          selectedLocation === "ALL" ||
          String(row.location_code) === selectedLocation;

        return materialMatches && locationMatches;
      }),
    [weekly, selectedMaterial, selectedLocation]
  );

  const selectedMaterialInfo = materialOptions.find(
    (item) => item.code === selectedMaterial
  );

  const mixedUnits = selectedMaterial === "ALL";

  // Aggregate weekly activity after applying the material/location filters.
  const weeklyActivity = useMemo(() => {
    const grouped = new Map<string, AnyRow>();

    filteredWeekly.forEach((row) => {
      const date = String(row.week_start ?? "");
      if (!date) return;

      const current = grouped.get(date) ?? {
        date,
        week: dateLabel(date),
        issued: 0,
        received: 0,
        unmet: 0,
        requested: 0,
        closingStock: 0,
        inventoryPosition: 0,
        reorderPoint: 0,
        targetStock: 0,
        stockCoverTotal: 0,
        stockCoverCount: 0,
        shortage: 0,
        rows: 0,
      };

      current.issued += num(row.issued_quantity);
      current.received += num(row.received_quantity);
      current.unmet += num(row.unmet_quantity);
      current.requested += num(row.requested_quantity);
      current.closingStock += num(row.closing_stock);
      current.inventoryPosition += num(row.inventory_position);
      current.reorderPoint += num(row.reorder_point);
      current.targetStock += num(row.target_stock);
      current.shortage += num(row.projected_shortage_before_delivery);

      const cover = Number(row.stock_cover_days);

      if (Number.isFinite(cover)) {
        current.stockCoverTotal += cover;
        current.stockCoverCount += 1;
      }

      current.rows += 1;

      grouped.set(date, current);
    });

    return Array.from(grouped.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((row) => ({
        ...row,
        averageCover:
          row.stockCoverCount > 0
            ? row.stockCoverTotal / row.stockCoverCount
            : 0,
      }));
  }, [filteredWeekly]);

  // Per-record scatter points preserve individual material/location observations.
  const scatterData = useMemo(
    () =>
      filteredWeekly
        .filter((row) => {
          const cover = Number(row.stock_cover_days);
          return Number.isFinite(cover);
        })
        .map((row) => ({
          cover: num(row.stock_cover_days),
          shortage: num(row.projected_shortage_before_delivery),
          material: String(row.item_code ?? ""),
          location: String(row.location_code ?? ""),
        })),
    [filteredWeekly]
  );

  // Monthly purchase order value is sourced from the purchase orders API.
  const procurementData = useMemo(() => {
    const grouped = new Map<string, number>();

    purchaseOrders.forEach((row) => {
      const date = String(row.order_date ?? row.order_week ?? "");

      if (!date) return;

      if (
        selectedMaterial !== "ALL" &&
        String(row.item_code) !== selectedMaterial
      ) {
        return;
      }

      if (
        selectedLocation !== "ALL" &&
        String(row.location_code) !== selectedLocation
      ) {
        return;
      }

      const month = date.slice(0, 7);

      grouped.set(
        month,
        (grouped.get(month) ?? 0) + num(row.total_cost)
      );
    });

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, spend]) => ({
        month: monthLabel(month),
        spend,
      }));
  }, [purchaseOrders, selectedMaterial, selectedLocation]);

  const datasetComposition = [
    { name: "Materials", value: materials.length },
    { name: "Forecasts", value: forecasts.length },
    { name: "Weekly inventory", value: weekly.length },
    { name: "Purchase orders", value: purchaseOrders.length },
  ].filter((item) => item.value > 0);

  const totalVisibleRecords =
    materials.length +
    forecasts.length +
    weekly.length +
    purchaseOrders.length;

  const totalSpend = procurementData.reduce(
    (sum, row) => sum + row.spend,
    0
  );

  const latestWeek = weekly.reduce((latest, row) => {
    const date = String(row.week_start ?? "");
    return date > latest ? date : latest;
  }, "");

  const selectedUnit = selectedMaterialInfo?.unit || "mixed units";

  const datasets = [
    {
      name: "Material Master",
      file: "materials.csv",
      category: "Master data",
      records: materials.length,
      description: "Material codes, categories, units, criticality and procurement parameters.",
      icon: <Boxes size={16} />,
    },
    {
      name: "Consumption History",
      file: "consumption.csv",
      category: "Historical data",
      records: null,
      description: "Historical material consumption used for forecasting model training.",
      icon: <Activity size={16} />,
    },
    {
      name: "Location Master",
      file: "locations.csv",
      category: "Master data",
      records: locationOptions.length || null,
      description: "Power utility locations associated with inventory and demand.",
      icon: <MapPin size={16} />,
    },
    {
      name: "Supplier Master",
      file: "suppliers.csv",
      category: "Master data",
      records: null,
      description: "Supplier profiles and lead-time parameters used in procurement analysis.",
      icon: <Truck size={16} />,
    },
    {
      name: "Purchase Orders",
      file: "purchase_orders.csv",
      category: "Procurement",
      records: purchaseOrders.length,
      description: "Order quantities, delivery dates, suppliers and receipt status.",
      icon: <Package size={16} />,
    },
    {
      name: "Weekly Inventory",
      file: "weekly_inventory.csv",
      category: "Inventory",
      records: weekly.length,
      description: "Weekly stock positions, receipts, issues, reorder points and shortages.",
      icon: <Database size={16} />,
    },
    {
      name: "Demand Forecasts",
      file: "forecasts.csv",
      category: "Model output",
      records: forecasts.length,
      description: "Forecast predictions and selected models for material-location combinations.",
      icon: <BrainCircuit size={16} />,
    },
  ];

  const chartCount = weeklyActivity.length;

  return (
    <main className="min-h-screen bg-[#080807] text-[#F1E8D8]">
      {/* SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[250px] border-r border-[#C9A362]/15 bg-[#050505] lg:flex lg:flex-col">
        <div className="flex h-[82px] items-center border-b border-[#C9A362]/15 px-7">
          <a href="/" className="text-[23px] font-bold tracking-[-1.3px]">
            GRID<span className="text-[#E6C98E]">STOCK</span>
            <span className="ml-2 text-[9px] tracking-[2px] text-[#8F826D]">
              AI
            </span>
          </a>
        </div>

        <div className="px-5 pt-9">
          <p className="mb-4 px-3 text-[9px] font-bold tracking-[2px] text-[#81745F]">
            WORKSPACE
          </p>

          <nav className="space-y-1">
            {[
              ["Overview", "/dashboard"],
              ["Demand Forecasting", "/dashboard/forecasting"],
              ["Inventory Intelligence", "/dashboard/inventory"],
              ["Material Intelligence", "/dashboard/materials"],
              ["Location Analysis", "/dashboard/locations"],
              ["Model Performance", "/dashboard/models"],
              ["Supplier Intelligence", "/dashboard/suppliers"],
              ["Scenario Intelligence", "/dashboard/scenarios"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="block rounded-sm px-3 py-3 text-[12px] text-[#9D9588] transition hover:bg-white/5 hover:text-[#E6C98E]"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>

        <div className="mt-9 px-5">
          <p className="mb-4 px-3 text-[9px] font-bold tracking-[2px] text-[#81745F]">
            SYSTEM
          </p>

          <a
            href="/dashboard/dataset"
            className="block rounded-sm border border-[#C9A362]/20 bg-[#C9A362]/10 px-3 py-3 text-[12px] text-[#E6C98E]"
          >
            Synthetic Dataset
          </a>

          <a
            href="/dashboard/evaluation"
            className="mt-1 block rounded-sm px-3 py-3 text-[12px] text-[#9D9588] transition hover:bg-white/5 hover:text-[#E6C98E]"
          >
            Model Evaluation
          </a>
        </div>

        <div className="mt-auto border-t border-[#C9A362]/15 p-5">
          <p className="text-[11px] font-semibold text-[#E8DDC8]">
            JANUS AIEngine
          </p>
          <p className="mt-1 text-[9px] text-[#8F826D]">
            Synthetic data environment
          </p>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="lg:pl-[250px]">
        <header className="sticky top-0 z-20 flex h-[82px] items-center justify-between border-b border-[#C9A362]/15 bg-[#080807]/95 px-5 backdrop-blur-xl sm:px-9">
          <div>
            <p className="text-[9px] font-bold tracking-[2px] text-[#A88B58]">
              JANUS AI/ SYSTEM
            </p>
            <h1 className="mt-1 text-[17px] font-semibold text-[#F0E5D1]">
              Synthetic Dataset
            </h1>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 border border-[#C9A362]/30 px-3 py-2 text-[10px] text-[#E6C98E] transition hover:bg-[#C9A362]/10 disabled:opacity-50"
          >
            <RefreshCw
              size={13}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </header>

        <div className="mx-auto max-w-[1700px] px-5 py-8 sm:px-8">
          {/* PAGE INTRO */}
          <section className="mb-7">
            <div className="mb-4 flex items-center gap-2 text-[9px] font-bold tracking-[2.5px] text-[#C5A56D]">
              <span className="h-px w-7 bg-[#C5A56D]" />
              DATA FOUNDATION / EXPLORER
            </div>

            <h2 className="font-[var(--font-cormorant)] text-[40px] leading-none text-[#F2E8D8] sm:text-[51px]">
              The Data Behind
              <br />
              <em className="text-[#E6C98E]">The Intelligence.</em>
            </h2>

            <p className="mt-4 max-w-[700px] text-[11px] leading-6 text-[#A69A85]">
              Explore the historical records, inventory movements, procurement
              activity and forecast outputs powering Janus AI.
            </p>
          </section>

          {/* DISCLOSURE */}
          <div className="mb-6 flex items-start gap-3 border border-[#C9A362]/20 bg-[#C9A362]/[0.055] px-4 py-3">
            <Database size={17} className="mt-0.5 shrink-0 text-[#E6C98E]" />
            <div>
              <p className="text-[9px] font-semibold tracking-wider text-[#E6C98E]">
                SYNTHETIC DATA ENVIRONMENT
              </p>
              <p className="mt-1 text-[9px] leading-5 text-[#B5A78F]">
                All records are simulated for this prototype and do not
                represent live or confidential GUVNL operational data.
              </p>
            </div>
          </div>

          {loading && (
            <div className="flex min-h-[250px] items-center justify-center gap-3 text-sm text-[#C9A362]">
              <RefreshCw size={18} className="animate-spin" />
              Loading backend dataset records...
            </div>
          )}

          {error && (
            <div className="mb-7 border border-red-500/30 bg-red-500/5 p-5">
              <p className="text-sm font-semibold text-red-300">
                Dataset loading failed
              </p>
              <p className="mt-2 text-xs text-red-200/70">{error}</p>
              <button
                onClick={loadData}
                className="mt-4 border border-red-400/30 px-4 py-2 text-xs text-red-200 hover:bg-red-400/10"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* TOP METRICS */}
              <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
                <StatCard
                  label="Dataset files"
                  value="07"
                  detail="Core datasets in this catalogue"
                  icon={<HardDrive size={17} />}
                />
                <StatCard
                  label="Materials"
                  value={formatNumber(materials.length)}
                  detail="Material master API records"
                  icon={<Boxes size={17} />}
                />
                <StatCard
                  label="Forecast records"
                  value={formatNumber(forecasts.length)}
                  detail="Forecast API records"
                  icon={<BrainCircuit size={17} />}
                />
                <StatCard
                  label="Connected records"
                  value={formatNumber(totalVisibleRecords)}
                  detail="Rows returned by four APIs"
                  icon={<Database size={17} />}
                />
              </section>

              {/* FILTER BAR */}
              <section className="mb-5 flex flex-col gap-3 border border-[#C9A362]/20 bg-[#10100F] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[9px] font-bold tracking-[1.8px] text-[#A88B58]">
                    ANALYTICS FILTERS
                  </p>
                  <p className="mt-1 text-[9px] text-[#8F8576]">
                    Select a material and location to explore actual records.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <select
                    value={selectedMaterial}
                    onChange={(event) => setSelectedMaterial(event.target.value)}
                    className="min-w-[180px] border border-[#C9A362]/25 bg-[#080807] px-3 py-2 text-[10px] text-[#E6C98E] outline-none"
                  >
                    <option value="ALL">All materials</option>
                    {materialOptions.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.code} · {item.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedLocation}
                    onChange={(event) => setSelectedLocation(event.target.value)}
                    className="min-w-[160px] border border-[#C9A362]/25 bg-[#080807] px-3 py-2 text-[10px] text-[#E6C98E] outline-none"
                  >
                    <option value="ALL">All locations</option>
                    {locationOptions.map((location) => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
                </div>
              </section>

              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[9px] tracking-[1.5px] text-[#A88B58]">
                  LIVE DATA EXPLORATION
                </p>
                <p className="text-[9px] text-[#8F8576]">
                  {formatNumber(filteredWeekly.length)} matching weekly records
                  {selectedMaterialInfo
                    ? ` · ${selectedMaterialInfo.unit}`
                    : " · mixed units"}
                </p>
              </div>

              {filteredWeekly.length === 0 && (
                <div className="mb-5 border border-[#C9A362]/20 bg-[#10100F] p-5 text-xs text-[#A99C86]">
                  No weekly inventory records match the selected filters.
                  Change the material or location selection to explore another
                  set of records.
                </div>
              )}

              {/* CHART GRID ROW 1 */}
              <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
                <Panel
                  className="xl:col-span-2"
                  eyebrow="01 / MULTI-SERIES TIME SERIES"
                  title="Weekly Inventory Activity"
                  description={`Actual weekly issues, receipts and unmet demand. ${
                    mixedUnits
                      ? "All materials selected: quantities are mixed units and should not be interpreted as one physical unit."
                      : `Selected material unit: ${selectedUnit}.`
                  }`}
                >
                  <div className="h-[250px] w-full">
                    {weeklyActivity.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={weeklyActivity}
                          margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="issueGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={GOLD} stopOpacity={0.24} />
                              <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="receiptGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={BLUE} stopOpacity={0.2} />
                              <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
                            </linearGradient>
                          </defs>

                          <CartesianGrid stroke="#FFFFFF" strokeOpacity={0.055} vertical={false} />
                          <XAxis dataKey="week" {...axisProps} minTickGap={18} />
                          <YAxis {...axisProps} />
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(value, name) => [
                              formatNumber(num(value), 2),
                              String(name),
                            ]}
                          />
                          <Legend
                            wrapperStyle={{
                              fontSize: 9,
                              color: MUTED,
                              paddingTop: 8,
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="issued"
                            name="Issued"
                            stroke={GOLD}
                            fill="url(#issueGradient)"
                            strokeWidth={2}
                            dot={false}
                          />
                          <Area
                            type="monotone"
                            dataKey="received"
                            name="Received"
                            stroke={BLUE}
                            fill="url(#receiptGradient)"
                            strokeWidth={1.8}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="unmet"
                            name="Unmet demand"
                            stroke={GREEN}
                            strokeWidth={1.8}
                            dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[#8F8576]">
                        No chart data available.
                      </div>
                    )}
                  </div>
                </Panel>

                <Panel
                  eyebrow="02 / STEP-STYLE STOCK TREND"
                  title="Inventory Position"
                  description="Weekly inventory position compared with reorder and target levels. Values are summed across selected locations."
                >
                  <div className="h-[250px] w-full">
                    {weeklyActivity.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={weeklyActivity}
                          margin={{ top: 8, right: 5, left: -22, bottom: 0 }}
                        >
                          <CartesianGrid stroke="#FFFFFF" strokeOpacity={0.055} vertical={false} />
                          <XAxis dataKey="week" {...axisProps} minTickGap={18} />
                          <YAxis {...axisProps} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Line
                            type="stepAfter"
                            dataKey="inventoryPosition"
                            name="Inventory position"
                            stroke={GOLD}
                            strokeWidth={2}
                            dot={false}
                          />
                          <Line
                            type="stepAfter"
                            dataKey="reorderPoint"
                            name="Reorder point"
                            stroke="#C17C69"
                            strokeWidth={1.4}
                            strokeDasharray="5 4"
                            dot={false}
                          />
                          <Line
                            type="stepAfter"
                            dataKey="targetStock"
                            name="Target stock"
                            stroke={GREEN}
                            strokeWidth={1.4}
                            strokeDasharray="3 4"
                            dot={false}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[#8F8576]">
                        No inventory position history.
                      </div>
                    )}
                  </div>
                </Panel>
              </section>

              {/* CHART GRID ROW 2 */}
              <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Panel
                  eyebrow="03 / MULTI-AXIS COMPARISON"
                  title="Demand, Receipts and Stock Cover"
                  description="Weekly issued quantity and receipts use the left axis; average stock-cover days use the right axis."
                >
                  <div className="h-[245px] w-full">
                    {weeklyActivity.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={weeklyActivity}
                          margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                        >
                          <CartesianGrid stroke="#FFFFFF" strokeOpacity={0.055} vertical={false} />
                          <XAxis dataKey="week" {...axisProps} minTickGap={18} />
                          <YAxis yAxisId="quantity" {...axisProps} />
                          <YAxis
                            yAxisId="cover"
                            orientation="right"
                            tick={{ fill: GREEN, fontSize: 9 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 9, color: MUTED }} />
                          <Bar
                            yAxisId="quantity"
                            dataKey="issued"
                            name="Issued quantity"
                            fill={GOLD}
                            opacity={0.8}
                            barSize={12}
                          />
                          <Bar
                            yAxisId="quantity"
                            dataKey="received"
                            name="Received quantity"
                            fill={BLUE}
                            opacity={0.8}
                            barSize={12}
                          />
                          <Line
                            yAxisId="cover"
                            type="monotone"
                            dataKey="averageCover"
                            name="Average stock cover (days)"
                            stroke={GREEN}
                            strokeWidth={2}
                            dot={false}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[#8F8576]">
                        No multi-axis data available.
                      </div>
                    )}
                  </div>
                </Panel>

                <Panel
                  eyebrow="04 / STACKED MOVEMENT BARS"
                  title="Weekly Receipts and Issues"
                  description="Weekly movement quantities shown together for comparison. These are separate movement categories, not inventory balances."
                >
                  <div className="h-[245px] w-full">
                    {weeklyActivity.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={weeklyActivity}
                          margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                        >
                          <CartesianGrid stroke="#FFFFFF" strokeOpacity={0.055} vertical={false} />
                          <XAxis dataKey="week" {...axisProps} minTickGap={18} />
                          <YAxis {...axisProps} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 9, color: MUTED }} />
                          <Bar
                            dataKey="received"
                            name="Receipts"
                            stackId="movement"
                            fill={BLUE}
                            barSize={18}
                          />
                          <Bar
                            dataKey="issued"
                            name="Issues"
                            stackId="movement"
                            fill={GOLD}
                            barSize={18}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[#8F8576]">
                        No movement records available.
                      </div>
                    )}
                  </div>
                </Panel>
              </section>

              {/* CHART GRID ROW 3 */}
              <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Panel
                  eyebrow="05 / RECORD-LEVEL SCATTER"
                  title="Stock Cover vs Projected Shortage"
                  description="Each point represents an actual weekly material-location record after applying the filters."
                >
                  <div className="h-[245px] w-full">
                    {scatterData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart
                          margin={{ top: 10, right: 12, left: -15, bottom: 5 }}
                        >
                          <CartesianGrid stroke="#FFFFFF" strokeOpacity={0.055} />
                          <XAxis
                            type="number"
                            dataKey="cover"
                            name="Stock cover"
                            unit=" days"
                            tick={{ fill: MUTED, fontSize: 9 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            type="number"
                            dataKey="shortage"
                            name="Projected shortage"
                            tick={{ fill: MUTED, fontSize: 9 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            cursor={{ strokeDasharray: "3 3" }}
                            contentStyle={tooltipStyle}
                            formatter={(value, name) => [
                              formatNumber(num(value), 2),
                              String(name),
                            ]}
                            labelFormatter={(_, payload) => {
                              const row = payload?.[0]?.payload;
                              return row
                                ? `${row.material} · ${row.location}`
                                : "Inventory record";
                            }}
                          />
                          <Scatter
                            data={scatterData}
                            fill={GOLD}
                            fillOpacity={0.72}
                          />
                        </ScatterChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[#8F8576]">
                        No scatter records available.
                      </div>
                    )}
                  </div>
                </Panel>

                <Panel
                  eyebrow="06 / COVERAGE MONITORING"
                  title="Stock Cover Threshold Analysis"
                  description="Average stock-cover days compared with the prototype's 7-day and 21-day monitoring thresholds. These are illustrative dashboard thresholds, not official GUVNL policies."
                >
                  <div className="h-[245px] w-full">
                    {weeklyActivity.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={weeklyActivity}
                          margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                        >
                          <CartesianGrid stroke="#FFFFFF" strokeOpacity={0.055} vertical={false} />
                          <XAxis dataKey="week" {...axisProps} minTickGap={18} />
                          <YAxis {...axisProps} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <ReferenceLine
                            y={7}
                            stroke="#C17C69"
                            strokeDasharray="5 4"
                            label={{
                              value: "7 days",
                              fill: "#C17C69",
                              fontSize: 9,
                              position: "insideTopRight",
                            }}
                          />
                          <ReferenceLine
                            y={21}
                            stroke={GREEN}
                            strokeDasharray="5 4"
                            label={{
                              value: "21 days",
                              fill: GREEN,
                              fontSize: 9,
                              position: "insideTopRight",
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="averageCover"
                            name="Average stock cover"
                            stroke={CHAMPAGNE}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[#8F8576]">
                        No stock-cover history available.
                      </div>
                    )}
                  </div>
                </Panel>
              </section>

              {/* PROCUREMENT AND COMPOSITION */}
              <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Panel
                  eyebrow="07 / PROCUREMENT ANALYTICS"
                  title="Monthly Purchase Order Value"
                  description="Actual purchase-order total_cost values grouped by order month and filtered by selected material/location."
                >
                  <div className="mb-3">
                    <p className="text-[9px] text-[#8F826D]">
                      VISIBLE PERIOD PROCUREMENT VALUE
                    </p>
                    <p className="mt-1 text-[21px] text-[#E6C98E]">
                      ₹{formatNumber(totalSpend / 100000, 2)} lakh
                    </p>
                  </div>

                  <div className="h-[220px] w-full">
                    {procurementData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={procurementData}
                          margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                        >
                          <CartesianGrid stroke="#FFFFFF" strokeOpacity={0.055} vertical={false} />
                          <XAxis dataKey="month" {...axisProps} />
                          <YAxis
                            {...axisProps}
                            tickFormatter={(value) =>
                              `₹${formatNumber(num(value) / 100000)}L`
                            }
                          />
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(value) => [
                              `₹${formatNumber(num(value), 2)}`,
                              "Order value",
                            ]}
                          />
                          <Bar
                            dataKey="spend"
                            name="Procurement value"
                            fill={GOLD}
                            radius={[2, 2, 0, 0]}
                            barSize={25}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[#8F8576]">
                        No purchase-order values returned by the API.
                      </div>
                    )}
                  </div>
                </Panel>

                <Panel
                  eyebrow="08 / DATASET COMPOSITION"
                  title="Connected Dataset Distribution"
                  description="Record counts returned by the connected APIs. This compares record counts, not disk size."
                >
                  <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-2">
                    <div className="h-[220px] w-full">
                      {datasetComposition.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={datasetComposition}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={57}
                              outerRadius={88}
                              paddingAngle={3}
                              stroke="none"
                            >

                            </Pie>
                            <Tooltip
                              contentStyle={tooltipStyle}
                              formatter={(value) => [
                                formatNumber(num(value)),
                                "Records",
                              ]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-[#8F8576]">
                          No connected records.
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      {datasetComposition.map((item, index) => (
                        <div
                          key={item.name}
                          className="flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                background:
                                  PIE_COLORS[index % PIE_COLORS.length],
                              }}
                            />
                            <span className="text-[9px] text-[#BDB09A]">
                              {item.name}
                            </span>
                          </div>
                          <span className="text-[10px] tabular-nums text-[#E6C98E]">
                            {formatNumber(item.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Panel>
              </section>

              {/* DATA COVERAGE */}
              <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Panel
                  eyebrow="DATA COVERAGE"
                  title="Dataset Dimensions"
                  description="Prototype dataset dimensions and latest available inventory date."
                >
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ["Materials", "20"],
                      ["Locations", "5"],
                      ["Suppliers", "8"],
                      ["History", "36 months"],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="border border-white/[0.07] p-3"
                      >
                        <p className="text-[8px] tracking-wider text-[#8F826D]">
                          {label.toUpperCase()}
                        </p>
                        <p className="mt-3 text-[17px] text-[#E6C98E]">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 border-t border-white/[0.07] pt-4">
                    <p className="text-[8px] tracking-wider text-[#8F826D]">
                      LATEST WEEK IN INVENTORY API
                    </p>
                    <p className="mt-2 text-[12px] text-[#D9C9AD]">
                      {latestWeek || "Not available"}
                    </p>
                    <p className="mt-2 text-[9px] text-[#8F8576]">
                      {formatNumber(chartCount)} distinct weekly periods after
                      applying the current filters.
                    </p>
                  </div>
                </Panel>

                <Panel
                  eyebrow="DATA PIPELINE"
                  title="How the data is used"
                  description="The records move through the JANUS AIintelligence workflow."
                >
                  <div className="space-y-4">
                    {[
                      ["01", "Historical consumption", "Input for demand modelling"],
                      ["02", "Forecast generation", "Predicted material requirements"],
                      ["03", "Inventory intelligence", "Stock positions and shortages"],
                      ["04", "Decision support", "Procurement and scenario analysis"],
                    ].map(([number, title, description]) => (
                      <div key={number} className="flex gap-3">
                        <span className="text-[9px] text-[#C9A362]">
                          {number}
                        </span>
                        <div>
                          <p className="text-[10px] text-[#E4D5BA]">
                            {title}
                          </p>
                          <p className="mt-1 text-[9px] text-[#8F8576]">
                            {description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </section>

              {/* DATA CATALOGUE */}
              <section className="border border-[#C9A362]/15 bg-[#10100F] p-5">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-bold tracking-[2px] text-[#A88B58]">
                      DATA CATALOGUE
                    </p>
                    <h3 className="mt-2 text-[15px] font-semibold text-[#EDE1CD]">
                      Available Dataset Files
                    </h3>
                    <p className="mt-1 text-[9px] text-[#8E8577]">
                      Connected record counts and dataset descriptions.
                    </p>
                  </div>
                  <span className="text-[9px] text-[#9D8965]">
                    07 DATASETS
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[740px] text-left">
                    <thead>
                      <tr className="border-b border-[#C9A362]/20 text-[8px] tracking-wider text-[#94856C]">
                        <th className="pb-3 pr-4 font-medium">DATASET</th>
                        <th className="pb-3 pr-4 font-medium">FILE</th>
                        <th className="pb-3 pr-4 font-medium">CATEGORY</th>
                        <th className="pb-3 pr-4 font-medium">RECORDS</th>
                        <th className="pb-3 font-medium">STATUS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {datasets.map((dataset) => (
                        <tr
                          key={dataset.file}
                          className="border-b border-white/[0.055]"
                        >
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-3">
                              <span className="text-[#C9A362]">
                                {dataset.icon}
                              </span>
                              <div>
                                <p className="text-[9px] font-semibold text-[#E4D5BA]">
                                  {dataset.name}
                                </p>
                                <p className="mt-1 max-w-[300px] text-[8px] leading-4 text-[#827866]">
                                  {dataset.description}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 pr-4 font-mono text-[8px] text-[#B5A78F]">
                            {dataset.file}
                          </td>

                          <td className="py-3 pr-4 text-[8px] text-[#A99C86]">
                            {dataset.category}
                          </td>

                          <td className="py-3 pr-4 text-[9px] tabular-nums text-[#E6C98E]">
                            {dataset.records === null
                              ? "Not exposed"
                              : formatNumber(dataset.records)}
                          </td>

                          <td className="py-3">
                            <span className="inline-flex items-center gap-1.5 text-[8px] text-emerald-400">
                              <CheckCircle2 size={11} />
                              Available
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="mt-4 text-[8px] leading-5 text-[#827866]">
                  "Not exposed" means the current connected APIs do not return
                  a direct record count for that source file. It does not mean
                  the dataset is missing.
                </p>
              </section>

              <footer className="mt-7 flex flex-col justify-between gap-3 border-t border-[#C9A362]/15 py-5 text-[8px] tracking-wider text-[#827866] sm:flex-row">
                <p>Janus AI · PS000213 · GUJARAT · 2026</p>
                <span className="flex items-center gap-2 text-emerald-400">
                  <ShieldCheck size={11} />
                  BACKEND DATA CONNECTED
                </span>
              </footer>
            </>
          )}
        </div>
      </div>
    </main>
  );
}