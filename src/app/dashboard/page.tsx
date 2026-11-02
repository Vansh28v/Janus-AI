"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Boxes,
  BrainCircuit,
  CalendarDays,
  CircleCheck,
  Database,
  GitBranch,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Truck,
  Zap,
} from "lucide-react";

import LogoutButton from "@/components/logout-button";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_BASE = "https://janus-ai-backend-j6bb.onrender.com";

type Forecast = {
  week_start: string;
  item_code: string;
  location_code: string;
  forecast_quantity: number;
  selected_model: string;
  classification: string;
  source: string;
};

type Evaluation = {
  item_code: string;
  location_code: string;
  classification: string;
  adi: number | null;
  cv2: number | null;
  selected_model: string;
  mae: number;
  rmse: number;
  wape: number | null;
  bias: number | null;
};

type Summary = {
  total_series: number;
  total_forecasts: number;
  forecast_horizon_weeks: number;
  test_period_weeks: number;
  mean_mae: number;
  mean_rmse: number;
  mean_wape: number;
  mean_bias: number;
};

type WorkspaceKey =
  | "forecasting"
  | "inventory"
  | "optimization"
  | "suppliers"
  | "scenarios";

type WorkspaceStatus = {
  label: string;
  status: "READY" | "UNAVAILABLE";
  compatible: boolean;
  allowed: boolean;
  reason?: string | null;
  missing_tables?: string[];
  missing_columns?: { table: string; columns: string[] }[];
};

type WorkspaceAccess = {
  success: boolean;
  dataset_mode: "SYNTHETIC" | "UPLOADED";
  dataset: {
    id?: string;
    name?: string;
    type?: string;
    status?: string;
  } | null;
  workspaces: Partial<Record<WorkspaceKey, WorkspaceStatus>>;
};

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

export default function DashboardPage() {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [evaluation, setEvaluation] = useState<Evaluation[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceAccess, setWorkspaceAccess] =
    useState<WorkspaceAccess | null>(null);

  async function loadWorkspaceAccess() {
    try {
      const response = await fetch(
        `${API_BASE}/api/data-intelligence/workspace-access`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Unable to retrieve workspace availability.");
      }

      const data: WorkspaceAccess = await response.json();
      setWorkspaceAccess(data);
    } catch (err) {
      console.error("Workspace availability could not be loaded:", err);
      setWorkspaceAccess(null);
    }
  }

  async function refreshDashboard() {
    await Promise.all([loadDashboard(), loadWorkspaceAccess()]);
  }

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    try {
      const [forecastResponse, evaluationResponse, summaryResponse] =
        await Promise.all([
          fetch(`${API_BASE}/api/forecasts?limit=5000`),
          fetch(`${API_BASE}/api/forecasts/evaluation`),
          fetch(`${API_BASE}/api/forecasts/summary`),
        ]);

      if (
        !forecastResponse.ok ||
        !evaluationResponse.ok ||
        !summaryResponse.ok
      ) {
        throw new Error("The backend returned an unsuccessful response.");
      }

      const forecastJson = await forecastResponse.json();
      const evaluationJson = await evaluationResponse.json();
      const summaryJson = await summaryResponse.json();

      setForecasts(forecastJson.data);
      setEvaluation(evaluationJson.data);
      setSummary(summaryJson);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to Janus AI backend."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    loadWorkspaceAccess();
  }, []);

  const weeklyForecast = useMemo(() => {
    const grouped = new Map<string, number>();

    forecasts.forEach((record) => {
      grouped.set(
        record.week_start,
        (grouped.get(record.week_start) || 0) +
          Number(record.forecast_quantity)
      );
    });

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, quantity]) => ({
        week: formatDate(week),
        quantity: Number(quantity.toFixed(2)),
      }));
  }, [forecasts]);

  const materialRanking = useMemo(() => {
    const grouped = new Map<string, number>();

    forecasts.forEach((record) => {
      grouped.set(
        record.item_code,
        (grouped.get(record.item_code) || 0) +
          Number(record.forecast_quantity)
      );
    });

    return Array.from(grouped.entries())
      .map(([material, quantity]) => ({
        material,
        quantity: Number(quantity.toFixed(2)),
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);
  }, [forecasts]);

  const locationRanking = useMemo(() => {
    const grouped = new Map<string, number>();

    forecasts.forEach((record) => {
      grouped.set(
        record.location_code,
        (grouped.get(record.location_code) || 0) +
          Number(record.forecast_quantity)
      );
    });

    return Array.from(grouped.entries())
      .map(([location, quantity]) => ({
        location,
        quantity: Number(quantity.toFixed(2)),
      }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [forecasts]);

  const modelDistribution = useMemo(() => {
    const grouped = new Map<string, number>();

    evaluation.forEach((record) => {
      grouped.set(
        record.selected_model,
        (grouped.get(record.selected_model) || 0) + 1
      );
    });

    return Array.from(grouped.entries())
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count);
  }, [evaluation]);

  const topModel = modelDistribution[0];

  function renderWorkspaceLink(
    key: WorkspaceKey,
    href: string,
    label: string,
    icon: React.ReactNode
  ) {
    const access = workspaceAccess?.workspaces?.[key];
    const allowed = access ? access.allowed : true;

    if (!allowed) {
      return (
        <div
          key={key}
          title={access?.reason || "This workspace is unavailable for the active dataset."}
          aria-disabled="true"
          className="flex cursor-not-allowed items-center justify-between gap-2 rounded-sm px-3 py-3 text-[12px] text-[#625B50] opacity-70"
        >
          <span className="flex items-center gap-3">
            {icon}
            {label}
          </span>
          <span className="flex items-center gap-1 text-[8px] tracking-wider text-[#9A7650]">
            <LockKeyhole size={10} />
            LOCKED
          </span>
        </div>
      );
    }

    return (
      <a
        key={key}
        href={href}
        className="flex items-center justify-between gap-2 rounded-sm px-3 py-3 text-[12px] text-[#9D9588] transition hover:bg-white/5 hover:text-[#E6C98E]"
      >
        <span className="flex items-center gap-3">
          {icon}
          {label}
        </span>
        {workspaceAccess?.dataset_mode === "UPLOADED" && (
          <span className="text-[8px] tracking-wider text-emerald-400">
            READY
          </span>
        )}
      </a>
    );
  }

  return (
    <main className="min-h-screen bg-[#080807] text-[#F1E8D8]">

      {/* SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[250px] border-r border-[#C9A362]/15 bg-[#050505] lg:flex lg:flex-col">

        <div className="flex h-[82px] items-center border-b border-[#C9A362]/15 px-7">
          <a href="/" className="text-[23px] font-bold tracking-[-1.3px]">
            JANUS<span className="text-[#E6C98E]"> AI</span>
            <span className="ml-2 text-[9px] font-medium tracking-[2px] text-[#8F826D]">
              AI
            </span>
          </a>
        </div>

        <div className="px-5 pt-9">
          <p className="mb-4 px-3 text-[9px] font-bold tracking-[2px] text-[#81745F]">
            WORKSPACE
          </p>

          <nav className="space-y-2">
  <a
    href="/dashboard"
    className="flex items-center gap-3 rounded-sm border border-[#C9A362]/20 bg-[#C9A362]/10 px-3 py-3 text-[12px] text-[#E6C98E]"
  >
    <LayoutDashboard size={16} />
    Overview
  </a>

  {renderWorkspaceLink(
    "forecasting",
    "/dashboard/forecasting",
    "Demand Forecasting",
    <BrainCircuit size={16} />
  )}



  {renderWorkspaceLink(
    "inventory",
    "/dashboard/inventory",
    "Inventory Intelligence",
    <Boxes size={16} />
  )}

  <a
  href="/dashboard/calendar"
  className="flex items-center gap-3 rounded-sm px-3 py-3 text-[12px] text-[#9D9588] transition hover:bg-white/5 hover:text-[#E6C98E]"
>
  <CalendarDays size={16} />
  Material Planning Calendar
</a>

  <a
    href="/dashboard/materials"
    className="flex items-center gap-3 rounded-sm px-3 py-3 text-[12px] text-[#9D9588] transition hover:bg-white/5 hover:text-[#E6C98E]"
  >
    <Boxes size={16} />
    Material Intelligence
  </a>

  <a
    href="/dashboard/locations"
    className="flex items-center gap-3 rounded-sm px-3 py-3 text-[12px] text-[#9D9588] transition hover:bg-white/5 hover:text-[#E6C98E]"
  >
    <MapPin size={16} />
    Location Analysis
  </a>

  <a
    href="/dashboard/models"
    className="flex items-center gap-3 rounded-sm px-3 py-3 text-[12px] text-[#9D9588] transition hover:bg-white/5 hover:text-[#E6C98E]"
  >
    <Activity size={16} />
    Model Performance
  </a>

  {renderWorkspaceLink(
    "suppliers",
    "/dashboard/suppliers",
    "Supplier Intelligence",
    <Truck size={16} />
  )}

  {renderWorkspaceLink(
    "scenarios",
    "/dashboard/scenarios",
    "Scenario Intelligence",
    <GitBranch size={16} />
  )}
</nav>
        </div>

        <div className="mt-9 px-5">
  <p className="mb-4 px-3 text-[9px] font-bold tracking-[2px] text-[#81745F]">
    SYSTEM
  </p>

  <a
    href="/dashboard/dataset"
    className="flex items-center gap-3 rounded-sm px-3 py-3 text-[12px] text-[#9D9588] transition hover:bg-white/5 hover:text-[#E6C98E]"
  >
    <Database size={16} />
    Synthetic Dataset
  </a>

  <a
    href="/dashboard/evaluation"
    className="flex items-center gap-3 rounded-sm px-3 py-3 text-[12px] text-[#9D9588] transition hover:bg-white/5 hover:text-[#E6C98E]"
  >
    <ShieldCheck size={16} />
    Model Evaluation
  </a>
</div>

        <div className="mt-auto border-t border-[#C9A362]/15 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#C9A362]/30 bg-[#C9A362]/10">
              <Zap size={16} className="text-[#E6C98E]" />
            </div>

            <div>
              <p className="text-[11px] font-semibold text-[#E8DDC8]">
                Janus AI Engine
              </p>
              <p className="mt-1 text-[9px] text-[#8F826D]">
                Forecasting module
              </p>
            </div>
          </div>
        </div>
      </aside>
            {/* MAIN CONTENT */}
      <div className="lg:pl-[250px]">

        {/* TOP BAR */}
        <header className="sticky top-0 z-20 flex h-[82px] items-center justify-between border-b border-[#C9A362]/15 bg-[#080807]/95 px-5 backdrop-blur-xl sm:px-9">
          <div>
            <p className="text-[9px] font-bold tracking-[2px] text-[#A88B58]">
              JANUS AI/ WORKSPACE
            </p>
            <h1 className="mt-1 text-[17px] font-semibold tracking-wide text-[#F0E5D1]">
              Intelligence Overview
            </h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <div className="hidden items-center gap-2 border border-[#C9A362]/20 px-3 py-2 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="max-w-[180px] truncate text-[10px] text-[#B5A78F]">
                {!workspaceAccess
                  ? "Checking dataset..."
                  : workspaceAccess.dataset_mode === "UPLOADED"
                    ? workspaceAccess.dataset?.name || "Uploaded dataset"
                    : "Synthetic environment"}
              </span>
            </div>

            <button
              onClick={refreshDashboard}
              disabled={loading}
              className="flex items-center gap-2 border border-[#C9A362]/30 px-3 py-2 text-[10px] text-[#E6C98E] transition hover:bg-[#C9A362]/10 disabled:opacity-50"
            >
              <RefreshCw
                size={13}
                className={loading ? "animate-spin" : ""}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <LogoutButton />
          </div>
        </header>

        {/* PAGE BODY */}
        <div className="mx-auto max-w-[1600px] px-5 py-8 sm:px-9 sm:py-10">

          {/* INTRO */}
          <section
            id="overview"
            className="mb-9 flex flex-col justify-between gap-5 xl:flex-row xl:items-end"
          >
            <div>
              <div className="mb-4 flex items-center gap-2 text-[9px] font-bold tracking-[2.5px] text-[#C5A56D]">
                <span className="h-px w-7 bg-[#C5A56D]" />
                POWER UTILITY INTELLIGENCE
              </div>

              <h2 className="font-[var(--font-cormorant)] text-[42px] leading-none text-[#F2E8D8] sm:text-[54px]">
                Demand & Inventory
                <br />
                <em className="text-[#E6C98E]">Intelligence.</em>
              </h2>

              <p className="mt-4 max-w-[560px] text-[12px] leading-7 text-[#A69A85]">
                A unified view of material demand forecasts,
                location-wise requirements and predictive
                model performance.
              </p>
            </div>

            <div className="flex items-center gap-3 text-[10px] text-[#9E927D]">
              <CalendarDays size={15} className="text-[#C9A362]" />
              12-week forecast horizon
            </div>
          </section>

          {/* ACTIVE DATASET NOTICE */}
          <div className="mb-7 flex flex-col gap-2 border border-[#C9A362]/20 bg-[#C9A362]/[0.055] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Database size={16} className="shrink-0 text-[#E6C98E]" />
              <p className="text-[10px] leading-5 text-[#C8B99E]">
                <strong className="font-semibold text-[#E6C98E]">
                  {!workspaceAccess
                    ? "CHECKING ACTIVE DATASET"
                    : workspaceAccess.dataset_mode === "UPLOADED"
                      ? "UPLOADED DATA ENVIRONMENT"
                      : "SYNTHETIC DATA ENVIRONMENT"}
                </strong>
                {" "}—{" "}
                {!workspaceAccess
                  ? "Retrieving the currently active dataset."
                  : workspaceAccess.dataset_mode === "UPLOADED"
                    ? `Workspace data is being served from ${workspaceAccess.dataset?.name || "your uploaded dataset"}.`
                    : "Forecasts and metrics are generated from simulated material consumption data, not live GUVNL records."}
              </p>
            </div>

            <span className="whitespace-nowrap text-[9px] tracking-wider text-[#9D8965]">
              {!workspaceAccess
                ? "LOADING"
                : workspaceAccess.dataset_mode === "UPLOADED"
                  ? "UPLOADED DATA"
                  : "DEMO MODE"}
            </span>
          </div>

          {/* LOADING */}
          {loading && !summary && (
            <div className="flex min-h-[300px] items-center justify-center gap-3 text-sm text-[#C9A362]">
              <LoaderCircle className="animate-spin" size={20} />
              Connecting to forecasting engine...
            </div>
          )}

          {/* ERROR */}
          {error && (
            <div className="mb-7 border border-red-500/30 bg-red-500/5 p-5">
              <p className="text-sm font-semibold text-red-300">
                Backend connection failed
              </p>
              <p className="mt-2 text-xs text-red-200/70">{error}</p>
              <button
                onClick={refreshDashboard}
                className="mt-4 border border-red-400/30 px-4 py-2 text-xs text-red-200 hover:bg-red-400/10"
              >
                Retry connection
              </button>
            </div>
          )}

          {/* DASHBOARD */}
          {summary && (
            <>
              {/* KPI CARDS */}
              <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Material-location series"
                  value={formatNumber(summary.total_series)}
                  description="Evaluated forecasting series"
                  icon={<Boxes size={18} />}
                />

                <MetricCard
                  label="Forecast predictions"
                  value={formatNumber(summary.total_forecasts)}
                  description={`${summary.forecast_horizon_weeks}-week forecast horizon`}
                  icon={<BrainCircuit size={18} />}
                />

                <MetricCard
                  label="Mean WAPE"
                  value={`${formatNumber(summary.mean_wape, 2)}%`}
                  description="Average series-level forecast error"
                  icon={<Activity size={18} />}
                  highlight
                />

                <MetricCard
                  label="Mean bias"
                  value={`${summary.mean_bias >= 0 ? "+" : ""}${formatNumber(summary.mean_bias, 2)}%`}
                  description="Average directional forecast error"
                  icon={<TrendingUp size={18} />}
                />
              </section>

              {/* FORECAST CHART + MODEL SUMMARY */}
              <section
                id="demand"
                className="mb-8 grid grid-cols-1 gap-5 xl:grid-cols-[1.65fr_1fr]"
              >
                <div className="border border-[#C9A362]/15 bg-[#10100F] p-5 sm:p-6">
                  <div className="mb-7 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-bold tracking-[2px] text-[#A88B58]">
                        DEMAND PROJECTION
                      </p>
                      <h3 className="mt-2 text-[16px] font-semibold text-[#EDE1CD]">
                        Weekly Forecast Trend
                      </h3>
                      <p className="mt-1 text-[10px] text-[#8E8577]">
                        Aggregated forecast across all materials and locations
                      </p>
                    </div>

                    <span className="border border-[#C9A362]/20 px-2 py-1 text-[9px] text-[#C9A362]">
                      12 WEEKS
                    </span>
                  </div>

                  <div className="h-[290px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={weeklyForecast}
                        margin={{ top: 5, right: 8, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="forecastGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="0%" stopColor="#D8B777" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#D8B777" stopOpacity={0} />
                          </linearGradient>
                        </defs>

                        <CartesianGrid stroke="#FFFFFF" strokeOpacity={0.06} vertical={false} />

                        <XAxis
                          dataKey="week"
                          tick={{ fill: "#938875", fontSize: 9 }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <YAxis
                          tick={{ fill: "#938875", fontSize: 9 }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <Tooltip
                          contentStyle={{
                            background: "#151411",
                            border: "1px solid #8D7041",
                            borderRadius: 2,
                            color: "#F1E8D8",
                            fontSize: 11,
                          }}
                          formatter={(value) => [
                            formatNumber(Number(value), 2),
                            "Forecast quantity",
                          ]}
                        />

                        <Area
                          type="monotone"
                          dataKey="quantity"
                          stroke="#D8B777"
                          strokeWidth={2}
                          fill="url(#forecastGradient)"
                          activeDot={{
                            r: 4,
                            fill: "#F5D99D",
                            stroke: "#080807",
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* MODEL SUMMARY */}
                <div
                  id="performance"
                  className="border border-[#C9A362]/15 bg-[#10100F] p-5 sm:p-6"
                >
                  <p className="text-[9px] font-bold tracking-[2px] text-[#A88B58]">
                    MODEL INTELLIGENCE
                  </p>

                  <h3 className="mt-2 text-[16px] font-semibold text-[#EDE1CD]">
                    Model Selection
                  </h3>

                  <p className="mt-1 text-[10px] text-[#8E8577]">
                    Selected models across evaluated series
                  </p>

                  <div className="mt-8 space-y-6">
                    {modelDistribution.map((model) => {
                      const percentage =
                        evaluation.length > 0
                          ? (model.count / evaluation.length) * 100
                          : 0;

                      return (
                        <div key={model.model}>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[11px] capitalize text-[#C9BDA8]">
                              {model.model.replaceAll("_", " ")}
                            </span>

                            <span className="text-[11px] tabular-nums text-[#E6C98E]">
                              {model.count}
                              <span className="ml-1 text-[#827866]">series</span>
                            </span>
                          </div>

                          <div className="h-1.5 overflow-hidden bg-white/[0.07]">
                            <div
                              className="h-full bg-gradient-to-r from-[#8C6738] to-[#E6C98E]"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>

                          <p className="mt-1 text-right text-[9px] text-[#817766]">
                            {formatNumber(percentage, 1)}%
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {topModel && (
                    <div className="mt-8 border-t border-[#C9A362]/15 pt-5">
                      <p className="text-[9px] tracking-[1.5px] text-[#8F826D]">
                        MOST FREQUENTLY SELECTED
                      </p>
                      <p className="mt-2 text-[20px] capitalize text-[#E6C98E]">
                        {topModel.model.replaceAll("_", " ")}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* MATERIAL AND LOCATION ANALYSIS */}
              <section className="mb-8 grid grid-cols-1 gap-5 xl:grid-cols-2">

                {/* MATERIAL RANKING */}
                <div
                  id="materials"
                  className="border border-[#C9A362]/15 bg-[#10100F] p-5 sm:p-6"
                >
                  <div className="mb-7">
                    <p className="text-[9px] font-bold tracking-[2px] text-[#A88B58]">
                      MATERIAL INTELLIGENCE
                    </p>
                    <h3 className="mt-2 text-[16px] font-semibold text-[#EDE1CD]">
                      Highest Forecast Demand
                    </h3>
                    <p className="mt-1 text-[10px] text-[#8E8577]">
                      Top eight materials by cumulative predicted quantity
                    </p>
                  </div>

                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={materialRanking}
                        layout="vertical"
                        margin={{ top: 0, right: 15, left: 15, bottom: 0 }}
                      >
                        <CartesianGrid
                          stroke="#FFFFFF"
                          strokeOpacity={0.06}
                          horizontal={false}
                        />

                        <XAxis
                          type="number"
                          tick={{ fill: "#938875", fontSize: 9 }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <YAxis
                          type="category"
                          dataKey="material"
                          width={100}
                          tick={{ fill: "#C9BDA8", fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <Tooltip
                          contentStyle={{
                            background: "#151411",
                            border: "1px solid #8D7041",
                            color: "#F1E8D8",
                            fontSize: 11,
                          }}
                          formatter={(value) => [
                            formatNumber(Number(value), 2),
                            "Forecast quantity",
                          ]}
                        />

                        <Bar
                          dataKey="quantity"
                          fill="#C49A52"
                          radius={[0, 2, 2, 0]}
                          barSize={17}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                                {/* LOCATION RANKING */}
                <div
                  id="locations"
                  className="border border-[#C9A362]/15 bg-[#10100F] p-5 sm:p-6"
                >
                  <div className="mb-7">
                    <p className="text-[9px] font-bold tracking-[2px] text-[#A88B58]">
                      LOCATION INTELLIGENCE
                    </p>
                    <h3 className="mt-2 text-[16px] font-semibold text-[#EDE1CD]">
                      Regional Demand Distribution
                    </h3>
                    <p className="mt-1 text-[10px] text-[#8E8577]">
                      Cumulative predicted quantity by location
                    </p>
                  </div>

                  <div className="space-y-6">
                    {locationRanking.map((location, index) => {
                      const maximum = locationRanking[0]?.quantity || 1;
                      const percentage = (location.quantity / maximum) * 100;

                      return (
                        <div key={location.location}>
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-[#8F826D]">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <span className="text-[11px] text-[#D7CCB8]">
                                {location.location}
                              </span>
                            </div>

                            <span className="text-[11px] tabular-nums text-[#E6C98E]">
                              {formatNumber(location.quantity, 2)}
                            </span>
                          </div>

                          <div className="h-1.5 overflow-hidden bg-white/[0.07]">
                            <div
                              className="h-full bg-gradient-to-r from-[#725127] to-[#E6C98E]"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-8 border-t border-[#C9A362]/15 pt-5">
                    <p className="text-[9px] leading-5 text-[#887D6C]">
                      Location totals aggregate forecasts across all
                      materials. Material units differ, so these totals
                      are numerical aggregates rather than a common
                      physical unit.
                    </p>
                  </div>
                </div>
              </section>

              {/* EVALUATION TABLE */}
              <section className="mb-8 border border-[#C9A362]/15 bg-[#10100F] p-5 sm:p-6">
                <div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-[9px] font-bold tracking-[2px] text-[#A88B58]">
                      MODEL VALIDATION
                    </p>
                    <h3 className="mt-2 text-[16px] font-semibold text-[#EDE1CD]">
                      Forecast Evaluation
                    </h3>
                    <p className="mt-1 text-[10px] text-[#8E8577]">
                      Chronological holdout evaluation across material-location series
                    </p>
                  </div>

                  <span className="text-[10px] text-[#9D8965]">
                    {evaluation.length} SERIES
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[750px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[#C9A362]/20 text-[9px] tracking-[1px] text-[#94856C]">
                        <th className="pb-4 pr-4 font-medium">MATERIAL</th>
                        <th className="pb-4 pr-4 font-medium">LOCATION</th>
                        <th className="pb-4 pr-4 font-medium">CATEGORY</th>
                        <th className="pb-4 pr-4 font-medium">MODEL</th>
                        <th className="pb-4 pr-4 font-medium">MAE</th>
                        <th className="pb-4 pr-4 font-medium">RMSE</th>
                        <th className="pb-4 font-medium">WAPE</th>
                      </tr>
                    </thead>

                    <tbody>
                      {evaluation.slice(0, 12).map((record) => (
                        <tr
                          key={`${record.item_code}-${record.location_code}`}
                          className="border-b border-white/[0.055] text-[10px] text-[#C9BDA8] transition hover:bg-white/[0.025]"
                        >
                          <td className="py-4 pr-4 font-semibold text-[#E4D5BA]">
                            {record.item_code}
                          </td>
                          <td className="py-4 pr-4 text-[#A99C86]">
                            {record.location_code}
                          </td>
                          <td className="py-4 pr-4 capitalize">
                            {record.classification}
                          </td>
                          <td className="py-4 pr-4 capitalize text-[#D8B777]">
                            {record.selected_model.replaceAll("_", " ")}
                          </td>
                          <td className="py-4 pr-4 tabular-nums">
                            {formatNumber(record.mae, 2)}
                          </td>
                          <td className="py-4 pr-4 tabular-nums">
                            {formatNumber(record.rmse, 2)}
                          </td>
                          <td className="py-4 tabular-nums">
                            {record.wape == null
                              ? "—"
                              : `${formatNumber(record.wape, 2)}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="mt-5 text-[9px] leading-5 text-[#827866]">
                  Showing the first 12 evaluated series. Full evaluation
                  data remains available through the backend API.
                  Missing metric values are displayed as dashes.
                </p>
              </section>

              {/* FOOTER */}
              <footer className="flex flex-col justify-between gap-3 border-t border-[#C9A362]/15 py-6 text-[9px] tracking-wider text-[#827866] sm:flex-row sm:items-center">
                <p>JANUS AI · PS000213 · GUJARAT · 2026</p>
                <div className="flex items-center gap-2">
                  <CircleCheck size={12} className="text-emerald-500" />
                  FORECASTING ENGINE CONNECTED
                </div>
              </footer>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  description,
  icon,
  highlight = false,
}: {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`border bg-[#10100F] p-5 transition hover:border-[#C9A362]/40 ${
        highlight
          ? "border-[#C9A362]/35"
          : "border-[#C9A362]/15"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold tracking-[1.5px] text-[#A0947E]">
          {label.toUpperCase()}
        </p>
        <span className="text-[#C9A362]">{icon}</span>
      </div>

      <p className="mt-5 text-[30px] font-semibold tracking-tight text-[#F0E5D1]">
        {value}
      </p>

      <p className="mt-2 text-[10px] text-[#8F8576]">
        {description}
      </p>
    </div>
  );
}