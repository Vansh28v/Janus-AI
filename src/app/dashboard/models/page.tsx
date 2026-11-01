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
  TrendingUp,
  Truck,
  Factory,
  BrainCircuit,
  Target,
  Award,
  BarChart3,
  ShieldCheck,
  Search,
  LockKeyhole,
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

type EvaluationRow = {
  model: string;
  item_code: string;
  location_code: string;
  mae: number;
  rmse: number;
  wape: number;
  mape: number;
  actual: number;
  predicted: number;
};

function num(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getRows(data: any): any[] {
  if (Array.isArray(data)) return data;

  if (!data || typeof data !== "object") return [];

  for (const key of [
    "records",
    "data",
    "results",
    "items",
    "evaluations",
    "evaluation",
    "forecasts",
  ]) {
    if (Array.isArray(data[key])) return data[key];
  }

  return [];
}

function firstValue(row: any, keys: string[], fallback: any = 0) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) {
      return row[key];
    }
  }
  return fallback;
}

function normalizeRows(rows: any[]): EvaluationRow[] {
  return rows.map((row) => ({
    model: String(
      firstValue(
        row,
        ["model", "model_name", "selected_model", "best_model", "algorithm"],
        "Unknown"
      )
    ),
    item_code: String(
      firstValue(row, ["item_code", "material_code"], "—")
    ),
    location_code: String(
      firstValue(row, ["location_code"], "—")
    ),
    mae: num(firstValue(row, ["mae", "MAE", "mean_absolute_error"])),
    rmse: num(firstValue(row, ["rmse", "RMSE", "root_mean_squared_error"])),
    wape: num(
      firstValue(row, [
        "wape",
        "WAPE",
        "weighted_absolute_percentage_error",
      ])
    ),
    mape: num(
      firstValue(row, [
        "mape",
        "MAPE",
        "mean_absolute_percentage_error",
      ])
    ),
    actual: num(
      firstValue(row, [
        "actual_quantity",
        "actual",
        "actual_demand",
        "y_true",
      ])
    ),
    predicted: num(
      firstValue(row, [
        "predicted_quantity",
        "forecast_quantity",
        "predicted",
        "forecast",
        "y_pred",
      ])
    ),
  }));
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function fmt(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(value);
}

function percentage(value: number) {
  return `${fmt(value)}%`;
}

function shortModel(name: string) {
  const names: Record<string, string> = {
    SNAIVE: "Seasonal Naive",
    "SEASONAL NAIVE": "Seasonal Naive",
    CROSTON: "Croston",
    SBA: "SBA",
    ETS: "ETS",
    HOLT_WINTERS: "Holt-Winters",
    "HOLT-WINTERS": "Holt-Winters",
    XGBOOST: "XGBoost",
  };

  return names[name.toUpperCase()] || name;
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
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
          <Icon size={19} color={GOLD} />
        </div>
      </div>
    </div>
  );
}

export default function ModelPerformancePage() {
  const [rows, setRows] = useState<EvaluationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workspaceUnavailable, setWorkspaceUnavailable] = useState(false);
  const [accessMessage, setAccessMessage] = useState("");
  const [search, setSearch] = useState("");
  const [selectedModel, setSelectedModel] = useState("All");

  useEffect(() => {
    let cancelled = false;

    async function loadEvaluation() {
      try {
        setLoading(true);
        setError("");
        setWorkspaceUnavailable(false);
        setAccessMessage("");

        const response = await fetch(`${API}/forecasts/evaluation`);

        if (response.status === 403) {
          let message =
            "The active dataset has not been approved for the forecasting workspace.";

          try {
            const result = await response.json();
            message =
              result?.message ||
              result?.detail?.message ||
              message;
          } catch {
            // Retain the default permission message.
          }

          if (!cancelled) {
            setWorkspaceUnavailable(true);
            setAccessMessage(message);
            setRows([]);
          }

          return;
        }

        if (!response.ok) {
          throw new Error(
            `Unable to load model evaluation data (${response.status}).`
          );
        }

        const data = await response.json();
        const evaluationRows = normalizeRows(getRows(data));

        if (!cancelled) {
          setRows(evaluationRows);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err?.message || "Unable to load forecasting evaluation."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadEvaluation();

    return () => {
      cancelled = true;
    };
  }, []);

  const modelNames = useMemo(
    () => Array.from(new Set(rows.map((row) => row.model))).sort(),
    [rows]
  );

  const modelComparison = useMemo(() => {
    return modelNames
      .map((model) => {
        const modelRows = rows.filter((row) => row.model === model);

        return {
          model,
          name: shortModel(model),
          mae: average(modelRows.map((row) => row.mae)),
          rmse: average(modelRows.map((row) => row.rmse)),
          wape: average(modelRows.map((row) => row.wape)),
          mape: average(modelRows.map((row) => row.mape)),
          records: modelRows.length,
        };
      })
      .sort((a, b) => a.wape - b.wape);
  }, [rows, modelNames]);

  const bestModel = modelComparison[0];

  const overall = useMemo(
    () => ({
      mae: average(rows.map((row) => row.mae)),
      rmse: average(rows.map((row) => row.rmse)),
      wape: average(rows.map((row) => row.wape)),
      mape: average(rows.map((row) => row.mape)),
    }),
    [rows]
  );

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesModel =
        selectedModel === "All" || row.model === selectedModel;

      const matchesSearch =
        row.item_code.toLowerCase().includes(search.toLowerCase()) ||
        row.location_code.toLowerCase().includes(search.toLowerCase()) ||
        row.model.toLowerCase().includes(search.toLowerCase());

      return matchesModel && matchesSearch;
    });
  }, [rows, selectedModel, search]);

  const modelDistribution = modelComparison.map((model, index) => ({
    name: model.name,
    value: model.records,
    color: ["#C9A362", "#7795B7", "#8DAD9B", "#B58BBD", "#D18C75"][
      index % 5
    ],
  }));

  const hasActualPrediction = rows.some(
    (row) => row.actual > 0 || row.predicted > 0
  );

  const predictionComparison = useMemo(() => {
    return rows
      .filter((row) => row.actual > 0 || row.predicted > 0)
      .slice(0, 15)
      .map((row, index) => ({
        name: row.item_code === "—" ? `Record ${index + 1}` : row.item_code,
        actual: row.actual,
        predicted: row.predicted,
      }));
  }, [rows]);

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
              const active = item.name === "Model Performance";

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
            Model metrics are calculated from the evaluation records of the
            currently active dataset.
          </p>
        </div>
      </aside>
            {/* Main */}
      <main className="min-h-screen lg:pl-[250px]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#24211C] px-6 py-6 md:px-9">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.25em] text-[#A68A5D]">
              <BrainCircuit size={13} />
              FORECASTING INTELLIGENCE
            </div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Model Performance
            </h1>
            <p className="mt-2 text-sm text-[#8D867B]">
              Evaluate forecasting accuracy and compare predictive model
              performance.
            </p>
          </div>

          <ActiveDataSource workspace="forecasting" />
        </header>

        <div className="space-y-7 px-6 py-7 md:px-9">
          {error && (
            <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {workspaceUnavailable && (
            <section className="rounded-2xl border border-[#66502F] bg-gradient-to-r from-[#211B12] to-[#11100E] p-6 md:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#66502F] bg-[#2D2416]">
                  <LockKeyhole size={23} color={GOLD} />
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-semibold text-[#E6C98E]">
                      Workspace Unavailable for Active Dataset
                    </h2>
                    <span className="rounded-full border border-[#75603A] bg-[#2D2416] px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-[#D9B979]">
                      Access restricted
                    </span>
                  </div>

                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[#B9B0A1]">
                    {accessMessage}
                  </p>

                  <p className="mt-3 max-w-3xl text-xs leading-5 text-[#918879]">
                    Model performance metrics require an active dataset that
                    has been normalized, quality-checked, and approved for
                    forecasting. Your other approved workspaces remain
                    available.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href="/dashboard/data-intelligence"
                      className="inline-flex items-center gap-2 rounded-lg border border-[#66502F] bg-[#2D2416] px-4 py-2.5 text-xs font-medium text-[#E6C98E] transition hover:bg-[#3A2D1A]"
                    >
                      Review dataset compatibility
                    </Link>

                    <Link
                      href="/dashboard"
                      className="inline-flex items-center gap-2 rounded-lg border border-[#39342B] px-4 py-2.5 text-xs text-[#C9C0B1] transition hover:bg-[#191610]"
                    >
                      Return to overview
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Best model */}
          {!workspaceUnavailable && !loading && bestModel && (
            <section className="rounded-2xl border border-[#514027] bg-gradient-to-r from-[#211A10] to-[#11100E] p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-xl border border-[#514027] bg-[#2A2113] p-3">
                    <Award size={23} color={GOLD} />
                  </div>
                  <div>
                    <p className="text-xs tracking-wider text-[#A68A5D]">
                      BEST PERFORMING MODEL
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-[#F1E8D8]">
                      {shortModel(bestModel.model)}
                    </h2>
                    <p className="mt-1 text-xs text-[#928B80]">
                      Lowest average WAPE among evaluated models
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-[#514027] bg-[#17130D] px-5 py-3">
                  <p className="text-[10px] text-[#928B80]">Average WAPE</p>
                  <p className="mt-1 text-2xl font-semibold text-[#E6C98E]">
                    {percentage(bestModel.wape)}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* KPIs */}
          {!workspaceUnavailable && (
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Mean Absolute Error"
                value={loading ? "—" : fmt(overall.mae)}
                subtitle="Average absolute forecast error"
                icon={Target}
              />
              <StatCard
                title="Root Mean Squared Error"
                value={loading ? "—" : fmt(overall.rmse)}
                subtitle="Penalizes larger prediction errors"
                icon={Activity}
              />
              <StatCard
                title="Weighted Absolute Percentage Error"
                value={loading ? "—" : percentage(overall.wape)}
                subtitle="Weighted forecast error percentage"
                icon={BarChart3}
              />
              <StatCard
                title="Evaluated Records"
                value={loading ? "—" : fmt(rows.length)}
                subtitle="Records in the evaluation dataset"
                icon={Boxes}
              />
            </section>
          )}

          {/* Model comparison */}
          {!workspaceUnavailable && (
            <section className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
              <div className="rounded-2xl border border-[#28251F] bg-[#11100E] p-5 md:p-6">
                <div className="mb-6">
                  <h2 className="text-base font-semibold">
                    Model accuracy comparison
                  </h2>
                  <p className="mt-1 text-xs text-[#777168]">
                    Lower WAPE indicates lower weighted forecast error
                  </p>
                </div>

                <div className="h-[300px]">
                  {loading ? (
                    <div className="flex h-full items-center justify-center text-sm text-[#777168]">
                      Loading evaluation...
                    </div>
                  ) : modelComparison.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-[#777168]">
                      No model comparison data available.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={modelComparison} barSize={42}>
                        <CartesianGrid
                          stroke="#29251F"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
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
                          formatter={(value: any) => [
                            `${fmt(Number(value))}%`,
                            "WAPE",
                          ]}
                        />
                        <Bar
                          dataKey="wape"
                          name="WAPE"
                          fill={GOLD}
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[#28251F] bg-[#11100E] p-5 md:p-6">
                <h2 className="text-base font-semibold">
                  Model evaluation coverage
                </h2>
                <p className="mt-1 text-xs text-[#777168]">
                  Distribution of evaluated records by model
                </p>

                <div className="mt-3 h-[220px]">
                  {loading ? (
                    <div className="flex h-full items-center justify-center text-sm text-[#777168]">
                      Loading...
                    </div>
                  ) : modelDistribution.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-[#777168]">
                      No evaluation coverage available.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={modelDistribution}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={4}
                        >
                          {modelDistribution.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
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
                  {modelDistribution.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 text-[#B9B0A1]">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: item.color }}
                        />
                        {item.name}
                      </div>
                      <span className="text-[#F1E8D8]">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Metric comparison table */}
          {!workspaceUnavailable && (
            <section className="overflow-hidden rounded-2xl border border-[#28251F] bg-[#11100E]">
              <div className="border-b border-[#28251F] p-5 md:p-6">
                <h2 className="text-base font-semibold">
                  Model evaluation summary
                </h2>
                <p className="mt-1 text-xs text-[#777168]">
                  Performance metrics aggregated by forecasting algorithm
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[750px] text-left">
                  <thead>
                    <tr className="border-b border-[#28251F] bg-[#15130F] text-[10px] uppercase tracking-wider text-[#8D867B]">
                      <th className="px-5 py-4 font-medium">Model</th>
                      <th className="px-5 py-4 font-medium">MAE</th>
                      <th className="px-5 py-4 font-medium">RMSE</th>
                      <th className="px-5 py-4 font-medium">WAPE</th>
                      <th className="px-5 py-4 font-medium">MAPE</th>
                      <th className="px-5 py-4 font-medium">Records</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-12 text-center text-sm text-[#777168]"
                        >
                          Loading model evaluation...
                        </td>
                      </tr>
                    ) : modelComparison.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-12 text-center text-sm text-[#777168]"
                        >
                          No evaluation records found.
                        </td>
                      </tr>
                    ) : (
                      modelComparison.map((model, index) => (
                        <tr
                          key={model.model}
                          className="border-b border-[#24211C] transition hover:bg-[#191610]"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              {index === 0 && (
                                <Award size={17} color={GOLD} />
                              )}
                              <span className="text-sm font-medium text-[#E9DFCD]">
                                {shortModel(model.model)}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm text-[#C9C0B1]">
                            {fmt(model.mae)}
                          </td>
                          <td className="px-5 py-4 text-sm text-[#C9C0B1]">
                            {fmt(model.rmse)}
                          </td>
                          <td className="px-5 py-4 text-sm text-[#E6C98E]">
                            {percentage(model.wape)}
                          </td>
                          <td className="px-5 py-4 text-sm text-[#C9C0B1]">
                            {percentage(model.mape)}
                          </td>
                          <td className="px-5 py-4 text-sm text-[#C9C0B1]">
                            {model.records}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
                    {/* Detailed evaluation records */}
          {!workspaceUnavailable && (
            <section className="overflow-hidden rounded-2xl border border-[#28251F] bg-[#11100E]">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#28251F] p-5 md:p-6">
                <div>
                  <h2 className="text-base font-semibold">
                    Detailed evaluation records
                  </h2>
                  <p className="mt-1 text-xs text-[#777168]">
                    Model results by material and location
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-2 rounded-lg border border-[#39342B] bg-[#090908] px-3 py-2">
                    <Search size={14} className="text-[#8D867B]" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search records..."
                      className="w-32 bg-transparent text-xs text-[#F1E8D8] outline-none placeholder:text-[#6F695F]"
                    />
                  </div>

                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="rounded-lg border border-[#39342B] bg-[#090908] px-3 py-2 text-xs text-[#D9CDB8] outline-none"
                  >
                    <option value="All">All models</option>
                    {modelNames.map((model) => (
                      <option key={model} value={model}>
                        {shortModel(model)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left">
                  <thead>
                    <tr className="border-b border-[#28251F] bg-[#15130F] text-[10px] uppercase tracking-wider text-[#8D867B]">
                      <th className="px-5 py-4 font-medium">Material</th>
                      <th className="px-5 py-4 font-medium">Location</th>
                      <th className="px-5 py-4 font-medium">Model</th>
                      <th className="px-5 py-4 font-medium">MAE</th>
                      <th className="px-5 py-4 font-medium">RMSE</th>
                      <th className="px-5 py-4 font-medium">WAPE</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-12 text-center text-sm text-[#777168]"
                        >
                          Loading records...
                        </td>
                      </tr>
                    ) : filteredRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-12 text-center text-sm text-[#777168]"
                        >
                          No matching evaluation records found.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.slice(0, 100).map((row, index) => (
                        <tr
                          key={`${row.item_code}-${row.location_code}-${row.model}-${index}`}
                          className="border-b border-[#24211C] hover:bg-[#191610]"
                        >
                          <td className="px-5 py-4 text-sm text-[#E9DFCD]">
                            {row.item_code}
                          </td>
                          <td className="px-5 py-4 text-sm text-[#C9C0B1]">
                            {row.location_code}
                          </td>
                          <td className="px-5 py-4 text-sm text-[#C9B995]">
                            {shortModel(row.model)}
                          </td>
                          <td className="px-5 py-4 text-sm text-[#C9C0B1]">
                            {fmt(row.mae)}
                          </td>
                          <td className="px-5 py-4 text-sm text-[#C9C0B1]">
                            {fmt(row.rmse)}
                          </td>
                          <td className="px-5 py-4 text-sm text-[#E6C98E]">
                            {percentage(row.wape)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-[#28251F] px-5 py-4 text-[10px] text-[#777168]">
                Showing up to 100 matching records · Evaluation source: active
                dataset
              </div>
            </section>
          )}

          {/* Methodology */}
          {!workspaceUnavailable && (
            <section className="rounded-2xl border border-[#514027] bg-gradient-to-r from-[#19150F] to-[#11100E] p-5 md:p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-xl border border-[#514027] bg-[#211B12] p-3">
                  <BrainCircuit size={20} color={GOLD} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#E6C98E]">
                    Understanding model evaluation
                  </h2>
                  <div className="mt-3 grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-xs font-medium text-[#E9DFCD]">
                        MAE
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#928B80]">
                        Measures the average absolute difference between
                        actual and predicted demand.
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#E9DFCD]">
                        RMSE
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#928B80]">
                        Gives greater weight to larger forecasting errors.
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#E9DFCD]">
                        WAPE
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#928B80]">
                        Expresses total absolute error relative to total
                        actual demand. Lower values indicate better accuracy.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#24211C] pt-5 text-[10px] text-[#69645B]">
            <span>Janus AI · MODEL PERFORMANCE & EVALUATION</span>
            <span>
              Evaluation based on the currently active dataset
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}