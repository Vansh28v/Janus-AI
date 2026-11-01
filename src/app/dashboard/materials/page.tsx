"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ActiveDataSource from "@/components/active-data-source";
import {
  Activity,
  AlertTriangle,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  Factory,
  Layers3,
  MapPin,
  Package,
  Search,
  ShieldAlert,
  Truck,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API = "http://localhost:8000/api";

type Material = {
  item_code: string;
  item_name: string;
  category: string;
  unit: string;
  criticality: string;
  unit_cost: number;
  lead_time_days: number;
  closing_stock: number;
  inventory_position: number;
  reorder_point: number;
  target_stock: number;
  stock_cover_days: number;
  forecast_quantity: number;
  projected_shortage: number;
  locations: number;
};

const num = (value: any) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const fmt = (value: any, digits = 0) =>
  num(value).toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });

const money = (value: any) => {
  const n = num(value);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

function getArray(data: any, keys: string[]) {
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return Array.isArray(data) ? data : [];
}

function getStatus(material: Material) {
  if (
    material.projected_shortage > 0 ||
    material.closing_stock < material.reorder_point
  ) {
    return "Critical";
  }

  if (material.closing_stock < material.target_stock) {
    return "Watch";
  }

  return "Healthy";
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Critical: "border-[#75483C]/50 bg-[#291711] text-[#E3A18B]",
    Watch: "border-[#75603A]/50 bg-[#251F12] text-[#D9B979]",
    Healthy: "border-[#3B6046]/50 bg-[#142018] text-[#9BB99C]",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${styles[status] ?? styles.Healthy}`}
    >
      {status}
    </span>
  );
}

function Metric({
  title,
  value,
  description,
  icon: Icon,
  accent = "#C9A362",
}: {
  title: string;
  value: string;
  description: string;
  icon: any;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#28241E] bg-[#100F0D] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#918879]">
            {title}
          </p>
          <p className="mt-3 text-2xl font-semibold text-[#F0E7D9]">
            {value}
          </p>
        </div>
        <div
          className="rounded-xl border p-2.5"
          style={{
            color: accent,
            borderColor: `${accent}35`,
            background: `${accent}10`,
          }}
        >
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-3 text-[11px] text-[#81796D]">{description}</p>
    </div>
  );
}

export default function MaterialIntelligencePage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forecastUnavailable, setForecastUnavailable] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [criticality, setCriticality] = useState("All");
  const [selected, setSelected] = useState<Material | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setError("");
        setForecastUnavailable(false);

        // Inventory is the primary dependency for this page.
        // Forecasting is optional: an uploaded dataset may be approved
        // for inventory while forecasting remains unavailable.
        const materialResponse = await fetch(`${API}/inventory/materials`);

        if (!materialResponse.ok) {
          throw new Error(
            `Unable to load material data (${materialResponse.status})`
          );
        }

        const materialData = await materialResponse.json();
        const materialRows = getArray(materialData, [
          "records",
          "data",
          "items",
        ]);

        let forecastRows: any[] = [];

        try {
          const forecastResponse = await fetch(`${API}/forecasts`);

          if (!forecastResponse.ok) {
            throw new Error(
              `Forecast API returned ${forecastResponse.status}`
            );
          }

          const forecastData = await forecastResponse.json();
          forecastRows = getArray(forecastData, [
            "forecasts",
            "data",
            "results",
            "items",
            "records",
          ]);
        } catch {
          // Keep inventory/material intelligence available without forecasts.
          if (!cancelled) setForecastUnavailable(true);
          forecastRows = [];
        }

        const forecastMap = new Map<string, number>();

        forecastRows.forEach((row: any) => {
          const code = String(row.item_code ?? row.material_code ?? "");
          if (!code) return;

          forecastMap.set(
            code,
            (forecastMap.get(code) ?? 0) +
              num(row.forecast_quantity ?? row.predicted_quantity)
          );
        });

        const normalized: Material[] = materialRows.map((row: any) => ({
          item_code: String(row.item_code ?? ""),
          item_name: String(row.item_name ?? row.item_code ?? "Unknown"),
          category: String(row.category ?? "Unclassified"),
          unit: String(row.unit ?? "units"),
          criticality: String(row.criticality ?? "Unclassified"),
          unit_cost: num(row.unit_cost),
          lead_time_days: num(row.lead_time_days),
          closing_stock: num(row.closing_stock),
          inventory_position: num(row.inventory_position),
          reorder_point: num(row.reorder_point),
          target_stock: num(row.target_stock),
          stock_cover_days: num(row.stock_cover_days),
          forecast_quantity: forecastMap.get(String(row.item_code)) ?? 0,
          projected_shortage: num(row.projected_shortage),
          locations: num(row.locations),
        }));

        if (!cancelled) {
          setMaterials(
            normalized.sort((a, b) =>
              a.item_name.localeCompare(b.item_name)
            )
          );
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Unable to load material intelligence.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(new Set(materials.map((m) => m.category))).sort(),
    ],
    [materials]
  );

  const filtered = useMemo(() => {
    return materials.filter((material) => {
      const matchesSearch =
        material.item_name.toLowerCase().includes(search.toLowerCase()) ||
        material.item_code.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        category === "All" || material.category === category;

      const matchesCriticality =
        criticality === "All" ||
        material.criticality.toLowerCase() === criticality.toLowerCase();

      return matchesSearch && matchesCategory && matchesCriticality;
    });
  }, [materials, search, category, criticality]);

  const summary = useMemo(() => {
    const critical = materials.filter(
      (m) => getStatus(m) === "Critical"
    ).length;

    const watch = materials.filter(
      (m) => getStatus(m) === "Watch"
    ).length;

    const healthy = materials.filter(
      (m) => getStatus(m) === "Healthy"
    ).length;

    const totalForecast = materials.reduce(
      (sum, m) => sum + m.forecast_quantity,
      0
    );

    const inventoryValue = materials.reduce(
      (sum, m) => sum + m.closing_stock * m.unit_cost,
      0
    );

    return {
      total: materials.length,
      critical,
      watch,
      healthy,
      totalForecast,
      inventoryValue,
    };
  }, [materials]);

  const chartData = useMemo(() => {
    return [...materials]
      .sort((a, b) => b.forecast_quantity - a.forecast_quantity)
      .slice(0, 10)
      .map((m) => ({
        name:
          m.item_name.length > 18
            ? `${m.item_name.slice(0, 16)}…`
            : m.item_name,
        demand: Number(m.forecast_quantity.toFixed(2)),
        stock: Number(m.closing_stock.toFixed(2)),
      }));
  }, [materials]);

  const criticalityData = useMemo(() => {
    const groups = new Map<string, number>();

    materials.forEach((m) => {
      const key = m.criticality || "Unclassified";
      groups.set(key, (groups.get(key) ?? 0) + 1);
    });

    return Array.from(groups.entries()).map(([name, count]) => ({
      name,
      count,
    }));
  }, [materials]);
    return (
    <div className="min-h-screen bg-[#080807] text-[#F1E8D8]">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[250px] flex-col border-r border-[#211E19] bg-[#050505] lg:flex">
        <div className="flex h-[82px] items-center border-b border-[#211E19] px-7">
          <div>
            <div className="text-[17px] font-bold tracking-[0.19em] text-[#E9D8B9]">
              JANUS AI<span className="text-[#C9A362]">AI</span>
            </div>
            <p className="mt-1 text-[9px] uppercase tracking-[0.25em] text-[#70685C]">
              Utility intelligence
            </p>
          </div>
        </div>

        <div className="px-5 pt-8">
          <p className="mb-4 px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-[#71695D]">
            Workspace
          </p>

          <nav className="space-y-1">
            {[
              { label: "Overview", href: "/dashboard", icon: Layers3 },
              {
                label: "Demand Forecasting",
                href: "/dashboard/forecasting",
                icon: Activity,
              },
              {
                label: "Inventory Intelligence",
                href: "/dashboard/inventory",
                icon: Boxes,
              },
              {
                label: "Material Intelligence",
                href: "/dashboard/materials",
                icon: Package,
                active: true,
              },
              {
                label: "Location Analysis",
                href: "/dashboard/locations",
                icon: MapPin,
              },
              {
                label: "Model Performance",
                href: "/dashboard/performance",
                icon: Activity,
              },
              {
                label: "Supplier Intelligence",
                href: "/dashboard/suppliers",
                icon: Truck,
              },
              {
                label: "Scenario Intelligence",
                href: "/dashboard/scenarios",
                icon: Factory,
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[11px] transition ${
                    item.active
                      ? "border border-[#C9A362]/25 bg-[#C9A362]/10 text-[#E8C98F]"
                      : "text-[#8E877C] hover:bg-[#171512] hover:text-[#E9E0D2]"
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                  {item.active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#C9A362]" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto border-t border-[#211E19] p-6">
          <div className="rounded-xl border border-[#30291F] bg-[#100E0B] p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.17em] text-[#C9A362]">
              Prototype environment
            </p>
            <p className="mt-2 text-[11px] leading-5 text-[#82796C]">
              Analytics follow the active dataset. Synthetic demo data and
              uploaded datasets are kept separate.
            </p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="min-h-screen lg:pl-[250px]">
        <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b border-[#211E19] bg-[#080807]/95 px-5 backdrop-blur-xl sm:px-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.19em] text-[#8B8172]">
              JANUS AI/ Workspace
            </p>
            <p className="mt-1 text-sm font-medium text-[#EDE3D3]">
              Material Intelligence
            </p>
          </div>

          <ActiveDataSource workspace="inventory" />
        </header>

        <div className="mx-auto max-w-[1600px] space-y-8 px-5 py-8 sm:px-8 lg:px-10">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#C9A362]">
                <span className="h-px w-7 bg-[#C9A362]" />
                Material portfolio analytics
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-[#F2E9DC] sm:text-[38px]">
                Material <span className="text-[#C9A362]">Intelligence</span>
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#918879]">
                Understand material demand, inventory exposure, criticality,
                and procurement requirements across the utility network.
              </p>
            </div>

            <div className="text-xs text-[#81786D]">
              {materials.length} material records
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-[#75483C]/50 bg-[#241510] p-4 text-sm text-[#E0A18D]">
              {error}
            </div>
          )}

          {forecastUnavailable && !loading && !error && (
            <div className="flex items-start gap-3 rounded-xl border border-[#75603A]/40 bg-[#211B10] p-4">
              <Activity size={16} className="mt-0.5 shrink-0 text-[#C9A362]" />
              <div>
                <p className="text-xs font-semibold text-[#E6C98E]">
                  Forecast data is currently unavailable
                </p>
                <p className="mt-1 text-[11px] leading-5 text-[#A99D8B]">
                  Material and inventory analytics remain available. Forecast
                  demand is shown as 0 because the active dataset does not
                  currently provide an accessible forecasting workspace.
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="rounded-2xl border border-[#28241E] bg-[#100F0D] p-12 text-center text-sm text-[#A99D8B]">
              Loading material intelligence…
            </div>
          ) : materials.length === 0 ? (
            <div className="rounded-2xl border border-[#28241E] bg-[#100F0D] p-12 text-center">
              <Package className="mx-auto text-[#C9A362]" size={28} />
              <p className="mt-4 text-sm text-[#E7DDCE]">
                No material records were returned by the inventory API.
              </p>
              <p className="mt-2 text-xs text-[#81786D]">
                Check that the inventory stock endpoint returns material-level
                records.
              </p>
            </div>
          ) : (
            <>
              {/* KPI cards */}
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric
                  title="Material portfolio"
                  value={fmt(summary.total)}
                  description="Unique materials in the inventory dataset"
                  icon={Package}
                />
                <Metric
                  title="Critical materials"
                  value={fmt(summary.critical)}
                  description="Materials below reorder point or with projected shortage"
                  icon={AlertTriangle}
                  accent="#D68C70"
                />
                <Metric
                  title="12-week forecast demand"
                  value={fmt(summary.totalForecast)}
                  description="Aggregated forecast quantity across materials"
                  icon={Activity}
                />
                <Metric
                  title="Estimated stock value"
                  value={money(summary.inventoryValue)}
                  description="Closing stock multiplied by material unit cost"
                  icon={CircleDollarSign}
                />
              </section>

              {/* Health and criticality */}
              <section className="grid gap-5 xl:grid-cols-3">
                <div className="rounded-2xl border border-[#28241E] bg-[#100F0D] p-6 xl:col-span-2">
                  <div className="mb-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C9A362]">
                      Inventory health
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-[#EFE6D8]">
                      Material stock status
                    </h2>
                    <p className="mt-1 text-xs text-[#81786D]">
                      Classification based on closing stock, reorder point,
                      target stock, and projected shortage.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      {
                        label: "Healthy",
                        count: summary.healthy,
                        color: "#8FA68E",
                        bg: "bg-[#142018]",
                      },
                      {
                        label: "Watch",
                        count: summary.watch,
                        color: "#D9B979",
                        bg: "bg-[#251F12]",
                      },
                      {
                        label: "Critical",
                        count: summary.critical,
                        color: "#D99578",
                        bg: "bg-[#291711]",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={`rounded-xl border border-[#30291F] ${item.bg} p-5`}
                      >
                        <p className="text-xs text-[#A99D8B]">{item.label}</p>
                        <p
                          className="mt-3 text-3xl font-semibold"
                          style={{ color: item.color }}
                        >
                          {item.count}
                        </p>
                        <p className="mt-1 text-[10px] text-[#81786D]">
                          Materials
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-[#28241E]">
                    {summary.total > 0 && (
                      <>
                        <div
                          className="h-full bg-[#789B83]"
                          style={{
                            width: `${(summary.healthy / summary.total) * 100}%`,
                          }}
                        />
                        <div
                          className="h-full bg-[#C9A362]"
                          style={{
                            width: `${(summary.watch / summary.total) * 100}%`,
                          }}
                        />
                        <div
                          className="h-full bg-[#C98770]"
                          style={{
                            width: `${(summary.critical / summary.total) * 100}%`,
                          }}
                        />
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#28241E] bg-[#100F0D] p-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C9A362]">
                    Material classification
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[#EFE6D8]">
                    Criticality distribution
                  </h2>

                  <div className="mt-5 space-y-4">
                    {criticalityData.map((item) => (
                      <div key={item.name}>
                        <div className="mb-2 flex justify-between text-xs">
                          <span className="text-[#B9AC97]">{item.name}</span>
                          <span className="text-[#E6C98E]">{item.count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[#29251F]">
                          <div
                            className="h-full rounded-full bg-[#C9A362]"
                            style={{
                              width: `${
                                summary.total
                                  ? (item.count / summary.total) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
                            {/* Demand chart */}
              <section className="rounded-2xl border border-[#28241E] bg-[#100F0D] p-5 sm:p-6">
                <div className="mb-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C9A362]">
                    Demand intelligence
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[#EFE6D8]">
                    Top materials by forecast demand
                  </h2>
                  <p className="mt-1 text-xs text-[#81786D]">
                    Comparison of aggregated forecast quantity and current
                    closing stock for the highest-demand materials.
                  </p>
                </div>

                <div className="h-[340px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 10, right: 15, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid
                        stroke="#29251F"
                        strokeDasharray="3 5"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#A99D8B", fontSize: 10 }}
                        axisLine={{ stroke: "#373027" }}
                        tickLine={false}
                        interval={0}
                        angle={-12}
                        textAnchor="end"
                        height={65}
                      />
                      <YAxis
                        tick={{ fill: "#8D8375", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={55}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#171512",
                          border: "1px solid #49402F",
                          borderRadius: 10,
                          color: "#F0E7D9",
                          fontSize: 11,
                        }}
                      />
                      <Legend
                        wrapperStyle={{
                          color: "#B5A994",
                          fontSize: 11,
                          paddingTop: 12,
                        }}
                      />
                      <Bar
                        dataKey="demand"
                        name="Forecast demand"
                        fill="#C9A362"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="stock"
                        name="Closing stock"
                        fill="#789B83"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* Material table */}
              <section className="overflow-hidden rounded-2xl border border-[#28241E] bg-[#100F0D]">
                <div className="border-b border-[#29241D] p-5 sm:p-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C9A362]">
                    Material catalogue
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[#EFE6D8]">
                    Material-level intelligence
                  </h2>
                  <p className="mt-1 text-xs text-[#81786D]">
                    Search, filter, and inspect individual material records.
                  </p>

                  <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_220px_200px]">
                    <div className="flex items-center gap-2 rounded-xl border border-[#30291F] bg-[#0B0A09] px-4">
                      <Search size={15} className="text-[#8D8375]" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search material name or code..."
                        className="w-full bg-transparent py-3 text-xs text-[#E9E0D2] outline-none placeholder:text-[#625B51]"
                      />
                    </div>

                    <div className="relative">
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full appearance-none rounded-xl border border-[#30291F] bg-[#0B0A09] px-4 py-3 text-xs text-[#D9CFBF] outline-none focus:border-[#C9A362]"
                      >
                        {categories.map((item) => (
                          <option key={item} value={item}>
                            {item === "All" ? "All categories" : item}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#81786D]"
                      />
                    </div>

                    <div className="relative">
                      <select
                        value={criticality}
                        onChange={(e) => setCriticality(e.target.value)}
                        className="w-full appearance-none rounded-xl border border-[#30291F] bg-[#0B0A09] px-4 py-3 text-xs text-[#D9CFBF] outline-none focus:border-[#C9A362]"
                      >
                        <option value="All">All criticality</option>
                        <option value="Vital">Vital</option>
                        <option value="Essential">Essential</option>
                        <option value="Desirable">Desirable</option>
                      </select>
                      <ChevronDown
                        size={14}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#81786D]"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1100px] text-left">
                    <thead className="bg-[#15130F]">
                      <tr className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[#938878]">
                        <th className="px-5 py-4">Material</th>
                        <th className="px-4 py-4">Category</th>
                        <th className="px-4 py-4">Criticality</th>
                        <th className="px-4 py-4 text-right">Closing stock</th>
                        <th className="px-4 py-4 text-right">Forecast demand</th>
                        <th className="px-4 py-4 text-right">Reorder point</th>
                        <th className="px-4 py-4 text-right">Lead time</th>
                        <th className="px-5 py-4 text-right">Health</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filtered.map((material) => (
                        <tr
                          key={material.item_code}
                          onClick={() => setSelected(material)}
                          className="cursor-pointer border-t border-[#25211B] text-xs transition hover:bg-[#17140F]"
                        >
                          <td className="px-5 py-4">
                            <p className="font-medium text-[#E4D9C9]">
                              {material.item_name}
                            </p>
                            <p className="mt-1 text-[10px] text-[#80776A]">
                              {material.item_code}
                            </p>
                          </td>
                          <td className="px-4 py-4 text-[#B5A994]">
                            {material.category}
                          </td>
                          <td className="px-4 py-4 text-[#B5A994]">
                            {material.criticality}
                          </td>
                          <td className="px-4 py-4 text-right tabular-nums text-[#D9CFBF]">
                            {fmt(material.closing_stock, 2)} {material.unit}
                          </td>
                          <td className="px-4 py-4 text-right tabular-nums text-[#E6C98E]">
                            {fmt(material.forecast_quantity, 2)}
                          </td>
                          <td className="px-4 py-4 text-right tabular-nums text-[#B5A994]">
                            {fmt(material.reorder_point, 2)}
                          </td>
                          <td className="px-4 py-4 text-right text-[#B5A994]">
                            {fmt(material.lead_time_days)} days
                          </td>
                          <td className="px-5 py-4 text-right">
                            <StatusPill status={getStatus(material)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filtered.length === 0 && (
                    <div className="p-8 text-center text-xs text-[#81786D]">
                      No materials match the selected filters.
                    </div>
                  )}
                </div>

                <div className="border-t border-[#29241D] px-5 py-4 text-[10px] text-[#81786D]">
                  Showing {filtered.length} of {materials.length} materials.
                  Select a row to inspect its details.
                </div>
              </section>

              {/* Selected material details */}
              {selected && (
                <section className="rounded-2xl border border-[#4A3C27] bg-[#15120D] p-5 sm:p-6">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C9A362]">
                        Selected material
                      </p>
                      <h2 className="mt-2 text-xl font-semibold text-[#F0E7D9]">
                        {selected.item_name}
                      </h2>
                      <p className="mt-1 text-xs text-[#81786D]">
                        {selected.item_code}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelected(null)}
                      className="rounded-lg border border-[#493C29] px-3 py-2 text-xs text-[#C9A362] hover:bg-[#211A10]"
                    >
                      Close details
                    </button>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      ["Category", selected.category],
                      ["Criticality", selected.criticality],
                      ["Unit", selected.unit],
                      ["Lead time", `${fmt(selected.lead_time_days)} days`],
                      ["Unit cost", money(selected.unit_cost)],
                      ["Inventory position", fmt(selected.inventory_position, 2)],
                      ["Target stock", fmt(selected.target_stock, 2)],
                      ["Stock cover", `${fmt(selected.stock_cover_days, 1)} days`],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-[#30291F] bg-[#0D0B08] p-4"
                      >
                        <p className="text-[10px] uppercase tracking-wider text-[#81786D]">
                          {label}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[#E6D9C6]">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          <div className="flex items-start gap-3 rounded-xl border border-[#30291F] bg-[#100E0B] p-4">
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-[#C9A362]" />
            <p className="text-[10px] leading-5 text-[#918879]">
              Prototype disclosure: displayed analytics are derived from the
              currently active dataset. Forecast totals aggregate material-level
              quantities and should not be interpreted as a single common
              physical unit or verified operational result. Synthetic demo
              outputs are simulated and are not actual utility records.
            </p>
          </div>

          <footer className="border-t border-[#211E19] py-6 text-center text-[10px] text-[#625B51]">
            Janus AI · Material Intelligence · Active dataset workspace
          </footer>
        </div>
      </main>
    </div>
  );
}