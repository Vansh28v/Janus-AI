"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ActiveDataSource from "@/components/active-data-source";
import {
  Layers3,
  Activity,
  Boxes,
  Package,
  MapPin,
  Truck,
  Factory,
  AlertTriangle,
  Search,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const API = "http://localhost:8000/api";

const GOLD = "#C9A362";

type LocationData = {
  location_code: string;
  closing_stock: number;
  inventory_position: number;
  reorder_point: number;
  target_stock: number;
  projected_shortage: number;
  stock_cover_days: number;
  forecast_demand: number;
  material_count: number;
  shortage_items: number;
  risk: string;
};

function number(value: any): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getRows(data: any): any[] {
  if (Array.isArray(data)) return data;

  for (const key of [
    "records",
    "data",
    "results",
    "items",
    "stock",
    "forecasts",
  ]) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  return [];
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function displayLocation(code: string) {
  const names: Record<string, string> = {
    "GUVNL-HO": "Head Office",
    "GUVNL-ANAND": "Anand",
    "GUVNL-VAD": "Vadodara",
    "GUVNL-AHM": "Ahmedabad",
    "GUVNL-SRT": "Surat",
  };

  // Preserve unknown uploaded location codes as-is.
  return names[code] || code;
}

function riskLevel(shortage: number, cover: number, stock: number) {
  const shortageRatio =
    stock > 0 ? shortage / stock : shortage > 0 ? 1 : 0;

  if (cover < 7 || shortageRatio >= 0.02) {
    return "Critical";
  }

  if (cover >= 21 && shortageRatio < 0.001) {
    return "Healthy";
  }

  return "Watch";
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "gold",
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#28251F] bg-[#11100E] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[#928B80]">{title}</p>
          <h3 className="mt-3 text-2xl font-semibold text-[#F1E8D8]">
            {value}
          </h3>
          <p className="mt-2 text-xs text-[#777168]">{subtitle}</p>
        </div>
        <div className="rounded-xl border border-[#3A3020] bg-[#211B12] p-3">
          <Icon
            size={19}
            style={{ color: color === "green" ? "#8DAD9B" : GOLD }}
          />
        </div>
      </div>
    </div>
  );
}

export default function LocationAnalysisPage() {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forecastUnavailable, setForecastUnavailable] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRisk, setSelectedRisk] = useState("All");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setError("");
        setForecastUnavailable(false);

        // Inventory is required for this page.
        const stockResponse = await fetch(`${API}/inventory/stock`);

        if (!stockResponse.ok) {
          throw new Error(
            `Unable to load inventory data (${stockResponse.status}).`
          );
        }

        const stockData = await stockResponse.json();
        const stockRows = getRows(stockData);

        // Forecasting is optional. A dataset may be approved for
        // inventory without being approved for forecasting.
        let forecastRows: any[] = [];

        try {
          const forecastResponse = await fetch(`${API}/forecasts`);

          if (!forecastResponse.ok) {
            throw new Error(
              `Forecast API returned ${forecastResponse.status}.`
            );
          }

          const forecastData = await forecastResponse.json();
          forecastRows = getRows(forecastData);
        } catch {
          forecastRows = [];

          if (!cancelled) {
            setForecastUnavailable(true);
          }
        }

        const locationMap = new Map<string, LocationData>();

        stockRows.forEach((row: any) => {
          const code = String(row.location_code ?? "").trim();
          if (!code) return;

          if (!locationMap.has(code)) {
            locationMap.set(code, {
              location_code: code,
              closing_stock: 0,
              inventory_position: 0,
              reorder_point: 0,
              target_stock: 0,
              projected_shortage: 0,
              stock_cover_days: 0,
              forecast_demand: 0,
              material_count: 0,
              shortage_items: 0,
              risk: "Healthy",
            });
          }

          const item = locationMap.get(code)!;

          item.closing_stock += number(row.closing_stock);
          item.inventory_position += number(row.inventory_position);
          item.reorder_point += number(row.reorder_point);
          item.target_stock += number(row.target_stock);

          const rowShortage = number(
            row.projected_shortage_before_delivery ??
              row.projected_shortage
          );

          item.projected_shortage += rowShortage;
          item.stock_cover_days += number(row.stock_cover_days);
          item.material_count += 1;

          if (rowShortage > 0) {
            item.shortage_items += 1;
          }
        });

        const forecastMap = new Map<string, number>();

        forecastRows.forEach((row: any) => {
          const code = String(row.location_code ?? "").trim();
          if (!code) return;

          forecastMap.set(
            code,
            (forecastMap.get(code) ?? 0) +
              number(row.forecast_quantity ?? row.predicted_quantity)
          );
        });

        const normalized: LocationData[] = Array.from(
          locationMap.values()
        ).map((item) => {
          const averageCover =
            item.material_count > 0
              ? item.stock_cover_days / item.material_count
              : 0;

          const shortage = item.projected_shortage;

          return {
            ...item,
            stock_cover_days: averageCover,
            forecast_demand: forecastMap.get(item.location_code) ?? 0,
            risk: riskLevel(
              shortage,
              averageCover,
              item.closing_stock
            ),
          };
        });

        normalized.sort((a, b) =>
          a.location_code.localeCompare(b.location_code)
        );

        if (!cancelled) {
          setLocations(normalized);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err?.message || "Unable to load location analysis."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredLocations = useMemo(() => {
    return locations.filter((location) => {
      const matchesSearch =
        displayLocation(location.location_code)
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        location.location_code.toLowerCase().includes(search.toLowerCase());

      const matchesRisk =
        selectedRisk === "All" || location.risk === selectedRisk;

      return matchesSearch && matchesRisk;
    });
  }, [locations, search, selectedRisk]);

  const summary = useMemo(() => {
    const totalStock = locations.reduce(
      (sum, item) => sum + item.closing_stock,
      0
    );

    const totalDemand = locations.reduce(
      (sum, item) => sum + item.forecast_demand,
      0
    );

    const totalShortage = locations.reduce(
      (sum, item) => sum + item.projected_shortage,
      0
    );

    const criticalLocations = locations.filter(
      (item) => item.risk === "Critical"
    ).length;

    const averageCover =
      locations.length > 0
        ? locations.reduce(
            (sum, item) => sum + item.stock_cover_days,
            0
          ) / locations.length
        : 0;

    return {
      totalStock,
      totalDemand,
      totalShortage,
      criticalLocations,
      averageCover,
    };
  }, [locations]);

  const chartData = useMemo(
    () =>
      locations.map((item) => ({
        location: displayLocation(item.location_code),
        stock: Number(item.closing_stock.toFixed(1)),
        demand: Number(item.forecast_demand.toFixed(1)),
        shortage: Number(item.projected_shortage.toFixed(1)),
      })),
    [locations]
  );

  const riskData = useMemo(
    () =>
      [
        {
          name: "Healthy",
          value: locations.filter((item) => item.risk === "Healthy").length,
        },
        {
          name: "Watch",
          value: locations.filter((item) => item.risk === "Watch").length,
        },
        {
          name: "Critical",
          value: locations.filter((item) => item.risk === "Critical").length,
        },
      ].filter((item) => item.value > 0),
    [locations]
  );
    return (
    <div className="min-h-screen bg-[#080807] text-[#F1E8D8]">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[250px] border-r border-[#24211C] bg-[#050505] lg:block">
        <div className="px-7 py-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#514027] bg-[#1B1710]">
              <Layers3 size={21} color={GOLD} />
            </div>
            <div>
              <p className="text-[15px] font-semibold tracking-[0.18em]">
                GRIDSTOCK
              </p>
              <p className="text-[9px] tracking-[0.32em] text-[#A68A5D]">
                INTELLIGENCE
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 pt-7">
          <p className="mb-5 px-3 text-[10px] font-semibold tracking-[0.28em] text-[#777168]">
            WORKSPACE
          </p>

          <nav className="space-y-2">
            {[
              { name: "Overview", href: "/dashboard", icon: Layers3 },
              {
                name: "Demand Forecasting",
                href: "/dashboard/forecasting",
                icon: Activity,
              },
              {
                name: "Inventory Intelligence",
                href: "/dashboard/inventory",
                icon: Boxes,
              },
              {
                name: "Material Intelligence",
                href: "/dashboard/materials",
                icon: Package,
              },
              {
                name: "Location Analysis",
                href: "/dashboard/locations",
                icon: MapPin,
              },
              {
                name: "Model Performance",
                href: "/dashboard/models",
                icon: TrendingUp,
              },
              {
                name: "Supplier Intelligence",
                href: "/dashboard/suppliers",
                icon: Truck,
              },
              {
                name: "Scenario Intelligence",
                href: "/dashboard/scenarios",
                icon: Factory,
              },
            ].map((item) => {
              const Icon = item.icon;
              const active = item.name === "Location Analysis";

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-4 rounded-xl px-4 py-3.5 text-[14px] transition ${
                    active
                      ? "border border-[#514027] bg-[#19150F] text-[#E8D4AC]"
                      : "border border-transparent text-[#D0C8BA] hover:bg-[#15130F]"
                  }`}
                >
                  <Icon size={19} />
                  <span>{item.name}</span>
                  {active && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-[#C9A362]" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="absolute bottom-6 left-5 right-5 rounded-xl border border-[#29251E] bg-[#11100E] p-4">
          <div className="flex items-center gap-2 text-xs text-[#C9A362]">
            <ShieldCheck size={15} />
            Prototype environment
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-[#777168]">
            Analytics follow the currently active dataset. Synthetic demo
            records are simulated and uploaded data remains separate.
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-h-screen lg:pl-[250px]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#24211C] px-6 py-6 md:px-9">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.25em] text-[#A68A5D]">
              <MapPin size={13} />
              NETWORK INTELLIGENCE
            </div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Location Analysis
            </h1>
            <p className="mt-2 text-sm text-[#8D867B]">
              Inventory distribution, demand and shortage exposure across
              locations.
            </p>
          </div>

          <ActiveDataSource workspace="inventory" />
        </header>

        <div className="space-y-7 px-6 py-7 md:px-9">
          {error && (
            <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {forecastUnavailable && !loading && !error && (
            <div className="flex items-start gap-3 rounded-xl border border-[#66502F] bg-[#211B12] p-4">
              <TrendingUp size={17} className="mt-0.5 shrink-0 text-[#C9A362]" />
              <div>
                <p className="text-xs font-semibold text-[#E6C98E]">
                  Forecast data unavailable for the active dataset
                </p>
                <p className="mt-1 text-[11px] leading-5 text-[#A99D8B]">
                  Location-level inventory and shortage analytics are still
                  available. Forecast demand is displayed as 0 because the
                  forecasting workspace is not currently accessible for this
                  dataset.
                </p>
              </div>
            </div>
          )}

          {/* KPI cards */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Locations"
              value={String(locations.length)}
              subtitle="Operational inventory locations"
              icon={MapPin}
            />
            <StatCard
              title="Total Closing Stock"
              value={formatNumber(summary.totalStock)}
              subtitle="Units across all materials and locations"
              icon={Boxes}
            />
            <StatCard
              title="Forecast Demand"
              value={formatNumber(summary.totalDemand)}
              subtitle="Aggregated forecast across locations"
              icon={TrendingUp}
            />
            <StatCard
              title="Critical Locations"
              value={String(summary.criticalLocations)}
              subtitle="Locations requiring attention"
              icon={AlertTriangle}
              color="green"
            />
          </section>

          {/* Secondary metrics */}
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[#28251F] bg-[#11100E] p-5">
              <p className="text-xs text-[#928B80]">
                Projected shortage quantity
              </p>
              <p className="mt-3 text-2xl font-semibold text-[#D18C75]">
                {formatNumber(summary.totalShortage)}
              </p>
              <p className="mt-2 text-xs text-[#777168]">
                Aggregated inventory shortage indicator
              </p>
            </div>

            <div className="rounded-2xl border border-[#28251F] bg-[#11100E] p-5">
              <p className="text-xs text-[#928B80]">Average stock cover</p>
              <p className="mt-3 text-2xl font-semibold text-[#E6C98E]">
                {formatNumber(summary.averageCover)} days
              </p>
              <p className="mt-2 text-xs text-[#777168]">
                Average across available location-material records
              </p>
            </div>

            <div className="rounded-2xl border border-[#28251F] bg-[#11100E] p-5">
              <p className="text-xs text-[#928B80]">Materials monitored</p>
              <p className="mt-3 text-2xl font-semibold text-[#F1E8D8]">
                {formatNumber(
                  locations.reduce(
                    (sum, item) => sum + item.material_count,
                    0
                  )
                )}
              </p>
              <p className="mt-2 text-xs text-[#777168]">
                Location-material inventory records
              </p>
            </div>
          </section>

          {/* Charts */}
          <section className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
            <div className="rounded-2xl border border-[#28251F] bg-[#11100E] p-5 md:p-6">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">
                    Location-wise stock vs demand
                  </h2>
                  <p className="mt-1 text-xs text-[#777168]">
                    Comparison of current stock and aggregated forecast demand
                  </p>
                </div>
                <span className="rounded-lg border border-[#373025] px-3 py-1.5 text-[10px] text-[#A68A5D]">
                  LOCATION COMPARISON
                </span>
              </div>

              <div className="h-[310px] w-full">
                {loading ? (
                  <div className="flex h-full items-center justify-center text-sm text-[#777168]">
                    Loading location data...
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={7}>
                      <CartesianGrid
                        stroke="#29251F"
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="location"
                        tick={{ fill: "#9C9589", fontSize: 11 }}
                        axisLine={{ stroke: "#39342B" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#777168", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#171510",
                          border: "1px solid #49402F",
                          borderRadius: 10,
                          color: "#F1E8D8",
                          fontSize: 12,
                        }}
                      />
                      <Legend
                        wrapperStyle={{
                          fontSize: 11,
                          color: "#B9B0A1",
                        }}
                      />
                      <Bar
                        dataKey="stock"
                        name="Closing stock"
                        fill={GOLD}
                        radius={[5, 5, 0, 0]}
                      />
                      <Bar
                        dataKey="demand"
                        name="Forecast demand"
                        fill="#7795B7"
                        radius={[5, 5, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[#28251F] bg-[#11100E] p-5 md:p-6">
              <h2 className="text-base font-semibold">
                Location risk distribution
              </h2>
              <p className="mt-1 text-xs text-[#777168]">
                Classification based on shortage and stock cover indicators
              </p>

              <div className="mt-3 h-[230px]">
                {loading ? (
                  <div className="flex h-full items-center justify-center text-sm text-[#777168]">
                    Loading...
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={riskData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={88}
                        paddingAngle={4}
                      >
                        {riskData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={
                              entry.name === "Critical"
                                ? "#D18C75"
                                : entry.name === "Watch"
                                  ? "#C9A362"
                                  : "#8DAD9B"
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "#171510",
                          border: "1px solid #49402F",
                          borderRadius: 10,
                          color: "#F1E8D8",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
                            <div className="space-y-3">
                {[
                  { label: "Healthy", color: "#8DAD9B" },
                  { label: "Watch", color: "#C9A362" },
                  { label: "Critical", color: "#D18C75" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 text-[#B9B0A1]">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: item.color }}
                      />
                      {item.label}
                    </div>
                    <span className="font-medium text-[#F1E8D8]">
                      {riskData.find((risk) => risk.name === item.label)
                        ?.value ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Location comparison table */}
          <section className="overflow-hidden rounded-2xl border border-[#28251F] bg-[#11100E]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#28251F] p-5 md:p-6">
              <div>
                <h2 className="text-base font-semibold">
                  Location intelligence
                </h2>
                <p className="mt-1 text-xs text-[#777168]">
                  Detailed inventory and demand position by location
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-[#39342B] bg-[#090908] px-3 py-2">
                  <Search size={14} className="text-[#8D867B]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search location..."
                    className="w-32 bg-transparent text-xs text-[#F1E8D8] outline-none placeholder:text-[#6F695F]"
                  />
                </div>

                <select
                  value={selectedRisk}
                  onChange={(e) => setSelectedRisk(e.target.value)}
                  className="rounded-lg border border-[#39342B] bg-[#090908] px-3 py-2 text-xs text-[#D9CDB8] outline-none"
                >
                  <option value="All">All risk levels</option>
                  <option value="Healthy">Healthy</option>
                  <option value="Watch">Watch</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left">
                <thead>
                  <tr className="border-b border-[#28251F] bg-[#15130F] text-[10px] uppercase tracking-wider text-[#8D867B]">
                    <th className="px-5 py-4 font-medium">Location</th>
                    <th className="px-5 py-4 font-medium">Materials</th>
                    <th className="px-5 py-4 font-medium">Closing stock</th>
                    <th className="px-5 py-4 font-medium">Forecast demand</th>
                    <th className="px-5 py-4 font-medium">Shortage</th>
                    <th className="px-5 py-4 font-medium">Stock cover</th>
                    <th className="px-5 py-4 font-medium">Risk status</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-12 text-center text-sm text-[#777168]"
                      >
                        Loading location intelligence...
                      </td>
                    </tr>
                  ) : filteredLocations.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-12 text-center text-sm text-[#777168]"
                      >
                        No matching locations found.
                      </td>
                    </tr>
                  ) : (
                    filteredLocations.map((item) => (
                      <tr
                        key={item.location_code}
                        className="border-b border-[#24211C] transition hover:bg-[#191610]"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="rounded-lg border border-[#403522] bg-[#211B12] p-2">
                              <MapPin size={16} color={GOLD} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[#E9DFCD]">
                                {displayLocation(item.location_code)}
                              </p>
                              <p className="mt-1 text-[10px] text-[#777168]">
                                {item.location_code}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-[#C9C0B1]">
                          {item.material_count}
                        </td>

                        <td className="px-5 py-4 text-sm font-medium text-[#E9DFCD]">
                          {formatNumber(item.closing_stock)}
                        </td>

                        <td className="px-5 py-4 text-sm text-[#B8C9DC]">
                          {formatNumber(item.forecast_demand)}
                        </td>

                        <td className="px-5 py-4 text-sm text-[#D18C75]">
                          {formatNumber(item.projected_shortage)}
                        </td>

                        <td className="px-5 py-4 text-sm text-[#C9B995]">
                          {formatNumber(item.stock_cover_days)} days
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full border px-3 py-1.5 text-[10px] font-medium ${
                              item.risk === "Critical"
                                ? "border-[#70433B] bg-[#351D19] text-[#E2A18F]"
                                : item.risk === "Watch"
                                  ? "border-[#66502F] bg-[#2D2416] text-[#D9B879]"
                                  : "border-[#385345] bg-[#192820] text-[#9CC5AA]"
                            }`}
                          >
                            {item.risk}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#28251F] px-5 py-4 text-[10px] text-[#777168]">
              <span>
                Showing {filteredLocations.length} of {locations.length}{" "}
                locations
              </span>
              <span>
                Source: Currently active inventory dataset
              </span>
            </div>
          </section>

          {/* Location insights */}
          <section className="rounded-2xl border border-[#514027] bg-gradient-to-r from-[#19150F] to-[#11100E] p-5 md:p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-xl border border-[#514027] bg-[#211B12] p-3">
                <Activity size={20} color={GOLD} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#E6C98E]">
                  Network planning insight
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#B9B0A1]">
                  Compare inventory availability with projected demand across
                  locations to identify potential shortages and areas requiring
                  closer monitoring. These indicators support better stock
                  distribution and replenishment planning.
                </p>
              </div>
            </div>
          </section>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#24211C] pt-5 text-[10px] text-[#69645B]">
            <span>Janus AI · LOCATION INTELLIGENCE</span>
            <span>
              Prototype using the active dataset · Not live GUVNL data
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}