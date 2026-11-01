"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ActiveDataSource from "@/components/active-data-source";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Database,
  Filter,
  Gauge,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
  X,
  LockKeyhole,
} from "lucide-react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

const API = "http://localhost:8000/api";

const GOLD = "#C9A362";
const LIGHT_GOLD = "#E6C98E";
const MUTED_GOLD = "#90764B";

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

const tooltipStyle = {
  backgroundColor: "#11100E",
  border: "1px solid #8D7041",
  borderRadius: "2px",
  color: "#F1E8D8",
  fontSize: "11px",
  padding: "10px 13px",
};

const axisStyle = {
  fill: "#928675",
  fontSize: 10,
};

const chartColors = [
  "#C9A362",
  "#E6C98E",
  "#8F754D",
  "#B8A17B",
  "#786344",
];

function getArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;

  for (const key of ["data", "records", "evaluation", "results", "items"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }

  return [];
}

function number(value: any): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmt(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return "—";

  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function labelize(value: string) {
  return value.replaceAll("_", " ");
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold tracking-[2.2px] text-[#B18D51]">
      {children}
    </p>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 border border-[#C9A362]/15 bg-[#10100F] ${className}`}
    >
      {children}
    </section>
  );
}

function PanelHeading({
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
      <SectionLabel>{eyebrow}</SectionLabel>
      <h3 className="mt-2 text-[16px] font-semibold tracking-tight text-[#F0E5D1]">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-[10px] leading-5 text-[#8F8576]">
          {description}
        </p>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  index,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  index: string;
}) {
  return (
    <div className="group relative overflow-hidden border border-[#C9A362]/15 bg-[#10100F] p-5 transition duration-300 hover:border-[#C9A362]/40">
      <div className="absolute right-0 top-0 h-20 w-20 translate-x-8 -translate-y-8 rounded-full bg-[#C9A362]/[0.055] blur-2xl transition group-hover:bg-[#C9A362]/10" />

      <div className="relative flex items-center justify-between">
        <p className="text-[9px] font-bold tracking-[1.6px] text-[#9C907C]">
          {label.toUpperCase()}
        </p>
        <span className="text-[#C9A362]">{icon}</span>
      </div>

      <div className="relative mt-6 flex items-end justify-between">
        <p className="text-[29px] font-semibold tracking-tight text-[#F1E8D8]">
          {value}
        </p>
        <span className="pb-1 text-[9px] tracking-widest text-[#705D3C]">
          {index}
        </span>
      </div>

      <p className="relative mt-2 text-[10px] text-[#82796B]">{detail}</p>

      <div className="mt-5 h-px w-full bg-gradient-to-r from-[#C9A362]/40 via-[#C9A362]/10 to-transparent" />
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full min-h-[180px] items-center justify-center text-[11px] text-[#82796B]">
      Not enough evaluation data to display this chart.
    </div>
  );
}

export default function ModelEvaluationPage() {
  const [records, setRecords] = useState<Evaluation[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workspaceUnavailable, setWorkspaceUnavailable] = useState(false);
  const [accessMessage, setAccessMessage] = useState("");

  const [search, setSearch] = useState("");
  const [modelFilter, setModelFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [sortBy, setSortBy] = useState("wape");

  async function loadData() {
    setLoading(true);
    setError("");
    setWorkspaceUnavailable(false);
    setAccessMessage("");

    try {
      const evaluationResponse = await fetch(`${API}/forecasts/evaluation`);

      if (evaluationResponse.status === 403) {
        let message =
          "The active dataset has not been approved for the forecasting workspace.";

        try {
          const result = await evaluationResponse.json();
          message =
            result?.message ||
            result?.detail?.message ||
            message;
        } catch {
          // Keep the default access message.
        }

        setWorkspaceUnavailable(true);
        setAccessMessage(message);
        setRecords([]);
        setSummary(null);
        return;
      }

      if (!evaluationResponse.ok) {
        throw new Error(
          `Unable to retrieve evaluation data (${evaluationResponse.status}).`
        );
      }

      const summaryResponse = await fetch(`${API}/forecasts/summary`);

      if (summaryResponse.status === 403) {
        let message =
          "The active dataset has not been approved for the forecasting workspace.";

        try {
          const result = await summaryResponse.json();
          message =
            result?.message ||
            result?.detail?.message ||
            message;
        } catch {
          // Keep the default access message.
        }

        setWorkspaceUnavailable(true);
        setAccessMessage(message);
        setRecords([]);
        setSummary(null);
        return;
      }

      if (!summaryResponse.ok) {
        throw new Error(
          `Unable to retrieve evaluation summary (${summaryResponse.status}).`
        );
      }

      const evaluationPayload = await evaluationResponse.json();
      const summaryPayload = await summaryResponse.json();

      const normalized: Evaluation[] = getArray(evaluationPayload).map(
        (row: any) => ({
          item_code: String(row.item_code ?? ""),
          location_code: String(row.location_code ?? ""),
          classification: String(row.classification ?? "Unclassified"),
          adi: row.adi == null ? null : number(row.adi),
          cv2: row.cv2 == null ? null : number(row.cv2),
          selected_model: String(row.selected_model ?? "Unknown"),
          mae: number(row.mae),
          rmse: number(row.rmse),
          wape: row.wape == null ? null : number(row.wape),
          bias: row.bias == null ? null : number(row.bias),
        })
      );

      setRecords(normalized);
      setSummary(summaryPayload);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load evaluation data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const models = useMemo(
    () => [...new Set(records.map((r) => r.selected_model))].sort(),
    [records]
  );

  const classifications = useMemo(
    () => [...new Set(records.map((r) => r.classification))].sort(),
    [records]
  );

  const locations = useMemo(
    () => [...new Set(records.map((r) => r.location_code))].sort(),
    [records]
  );

  const modelComparison = useMemo(() => {
    const grouped = new Map<
      string,
      {
        count: number;
        wape: number;
        wapeCount: number;
        mae: number;
        rmse: number;
        bias: number;
        biasCount: number;
      }
    >();

    records.forEach((r) => {
      const current = grouped.get(r.selected_model) ?? {
        count: 0,
        wape: 0,
        wapeCount: 0,
        mae: 0,
        rmse: 0,
        bias: 0,
        biasCount: 0,
      };

      current.count += 1;
      current.mae += r.mae;
      current.rmse += r.rmse;

      if (r.wape !== null) {
        current.wape += r.wape;
        current.wapeCount += 1;
      }

      if (r.bias !== null) {
        current.bias += r.bias;
        current.biasCount += 1;
      }

      grouped.set(r.selected_model, current);
    });

    return Array.from(grouped.entries())
      .map(([model, v]) => ({
        model,
        series: v.count,
        averageWape: v.wapeCount ? v.wape / v.wapeCount : 0,
        averageMae: v.count ? v.mae / v.count : 0,
        averageRmse: v.count ? v.rmse / v.count : 0,
        averageBias: v.biasCount ? v.bias / v.biasCount : 0,
      }))
      .sort((a, b) => a.averageWape - b.averageWape);
  }, [records]);

  const bestModel = modelComparison[0];

  const classificationCounts = useMemo(() => {
    const grouped = new Map<string, number>();

    records.forEach((r) => {
      grouped.set(
        r.classification,
        (grouped.get(r.classification) ?? 0) + 1
      );
    });

    return Array.from(grouped.entries()).map(([name, count]) => ({
      name,
      count,
    }));
  }, [records]);

  const errorDistribution = useMemo(() => {
    const valid = records
      .map((r) => r.wape)
      .filter((v): v is number => v !== null);

    const bins = [
      { label: "0–10%", min: 0, max: 10 },
      { label: "10–20%", min: 10, max: 20 },
      { label: "20–30%", min: 20, max: 30 },
      { label: "30–40%", min: 30, max: 40 },
      { label: "40–50%", min: 40, max: 50 },
      { label: "50%+", min: 50, max: Infinity },
    ];

    return bins.map((bin) => ({
      range: bin.label,
      count: valid.filter((v) => v >= bin.min && v < bin.max).length,
    }));
  }, [records]);

  const biasByModel = useMemo(
    () =>
      modelComparison.map((m) => ({
        model: m.model,
        bias: m.averageBias,
      })),
    [modelComparison]
  );

  const scatterData = useMemo(
    () =>
      records.map((r) => ({
        ...r,
        name: `${r.item_code} · ${r.location_code}`,
      })),
    [records]
  );

  const filteredRecords = useMemo(() => {
    let result = records.filter((r) => {
      const term = search.toLowerCase();

      const matchesSearch =
        !term ||
        r.item_code.toLowerCase().includes(term) ||
        r.location_code.toLowerCase().includes(term) ||
        r.selected_model.toLowerCase().includes(term);

      return (
        matchesSearch &&
        (modelFilter === "all" || r.selected_model === modelFilter) &&
        (classFilter === "all" || r.classification === classFilter) &&
        (locationFilter === "all" || r.location_code === locationFilter)
      );
    });

    result = [...result].sort((a, b) => {
      if (sortBy === "mae") return b.mae - a.mae;
      if (sortBy === "rmse") return b.rmse - a.rmse;
      if (sortBy === "bias")
        return Math.abs(b.bias ?? 0) - Math.abs(a.bias ?? 0);
      return (b.wape ?? -1) - (a.wape ?? -1);
    });

    return result;
  }, [records, search, modelFilter, classFilter, locationFilter, sortBy]);

  const filterActive =
    search !== "" ||
    modelFilter !== "all" ||
    classFilter !== "all" ||
    locationFilter !== "all";

  function clearFilters() {
    setSearch("");
    setModelFilter("all");
    setClassFilter("all");
    setLocationFilter("all");
    setSortBy("wape");
  }

  const selectClass =
    "w-full appearance-none border border-[#C9A362]/20 bg-[#0B0B0A] px-3 py-3 pr-8 text-[10px] text-[#DCCBAE] outline-none transition focus:border-[#C9A362]/60";
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
              <Link
                key={href}
                href={href}
                className="block rounded-sm px-3 py-3 text-[12px] text-[#9D9588] transition hover:bg-white/5 hover:text-[#E6C98E]"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-9 px-5">
          <p className="mb-4 px-3 text-[9px] font-bold tracking-[2px] text-[#81745F]">
            SYSTEM
          </p>

          <Link
            href="/dashboard/dataset"
            className="block rounded-sm px-3 py-3 text-[12px] text-[#9D9588] transition hover:bg-white/5 hover:text-[#E6C98E]"
          >
            Synthetic Dataset
          </Link>

          <Link
            href="/dashboard/evaluation"
            className="mt-1 block rounded-sm border border-[#C9A362]/25 bg-[#C9A362]/10 px-3 py-3 text-[12px] text-[#E6C98E]"
          >
            Model Evaluation
          </Link>
        </div>

        <div className="mt-auto border-t border-[#C9A362]/15 p-5">
          <p className="text-[11px] font-semibold text-[#E8DDC8]">
            JANUS AIEngine
          </p>
          <p className="mt-1 text-[9px] text-[#8F826D]">
            Model validation module
          </p>
        </div>
      </aside>

      {/* MAIN */}
      <div className="lg:pl-[250px]">
        <header className="sticky top-0 z-20 flex min-h-[82px] flex-wrap items-center justify-between gap-4 border-b border-[#C9A362]/15 bg-[#080807]/95 px-5 py-4 backdrop-blur-xl sm:px-9">
          <div>
            <p className="text-[9px] font-bold tracking-[2px] text-[#A88B58]">
              JANUS AI/ INTELLIGENCE
            </p>
            <h1 className="mt-1 text-[17px] font-semibold text-[#F0E5D1]">
              Model Evaluation
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ActiveDataSource workspace="forecasting" />
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 border border-[#C9A362]/30 px-4 py-2.5 text-[11px] text-[#E6C98E] transition hover:bg-[#C9A362]/10 disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={loading ? "animate-spin" : ""}
              />
              Refresh data
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-[1650px] px-5 py-8 sm:px-9 sm:py-10">
          {/* HERO */}
          <section className="mb-9">
            <div className="mb-5 flex items-center gap-2 text-[9px] font-bold tracking-[2.5px] text-[#C5A56D]">
              <span className="h-px w-7 bg-[#C5A56D]" />
              FORECAST VALIDATION / ANALYTICS
            </div>

            <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
              <div>
                <h2 className="font-[var(--font-cormorant)] text-[43px] leading-[0.98] text-[#F2E8D8] sm:text-[57px]">
                  The science of
                  <br />
                  <em className="text-[#E6C98E]">forecast accuracy.</em>
                </h2>

                <p className="mt-5 max-w-[650px] text-[12px] leading-7 text-[#A69A85]">
                  Inspect model selection, quantify forecast errors and
                  understand predictive performance across material-location
                  combinations.
                </p>
              </div>

              <div className="flex items-center gap-3 border border-[#C9A362]/20 bg-[#C9A362]/[0.045] px-4 py-3">
                <Database size={17} className="text-[#D5B477]" />
                <div>
                  <p className="text-[9px] font-bold tracking-[1.5px] text-[#D9BD88]">
                    ACTIVE DATASET EVALUATION
                  </p>
                  <p className="mt-1 text-[9px] text-[#887D6D]">
                    Chronological holdout validation
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* DATA NOTICE */}
          <div className="mb-8 flex items-start gap-3 border border-[#C9A362]/20 bg-[#C9A362]/[0.045] px-4 py-4">
            <ShieldCheck
              size={18}
              className="mt-0.5 shrink-0 text-[#E6C98E]"
            />
            <div>
              <p className="text-[10px] font-semibold tracking-wide text-[#E6C98E]">
                DATASET-AWARE MODEL VALIDATION
              </p>
              <p className="mt-1 text-[10px] leading-5 text-[#A99B82]">
                Metrics are retrieved from the currently active dataset.
                Synthetic demo results are simulated and must not be
                interpreted as measurements from live GUVNL operations.
              </p>
            </div>
          </div>

          {/* LOADING */}
          {loading && (
            <div className="flex min-h-[260px] items-center justify-center gap-3 text-sm text-[#C9A362]">
              <RefreshCw size={19} className="animate-spin" />
              Loading model intelligence...
            </div>
          )}

          {/* WORKSPACE ACCESS RESTRICTION */}
          {!loading && workspaceUnavailable && (
            <section className="border border-[#C9A362]/30 bg-[#C9A362]/[0.045] p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-[#C9A362]/30 bg-[#C9A362]/10">
                  <LockKeyhole size={22} className="text-[#E6C98E]" />
                </div>

                <div className="flex-1">
                  <p className="text-[9px] font-bold tracking-[2px] text-[#C9A362]">
                    FORECASTING ACCESS RESTRICTED
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-[#E6C98E]">
                    Model Evaluation Unavailable
                  </h2>
                  <p className="mt-3 max-w-2xl text-[12px] leading-6 text-[#B9AD99]">
                    {accessMessage ||
                      "The active dataset is not currently approved for the forecasting workspace."}
                  </p>
                  <p className="mt-3 max-w-2xl text-[10px] leading-5 text-[#8F8576]">
                    Model evaluation requires forecasting workspace
                    compatibility and approval. Inventory and other
                    independently approved workspaces can remain available.
                    No synthetic evaluation results will be substituted.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      href="/dashboard/data-intelligence"
                      className="border border-[#C9A362]/40 bg-[#C9A362]/10 px-4 py-3 text-[10px] font-semibold tracking-wide text-[#E6C98E] transition hover:bg-[#C9A362]/20"
                    >
                      REVIEW DATASET COMPATIBILITY
                    </Link>
                    <Link
                      href="/dashboard"
                      className="border border-white/10 px-4 py-3 text-[10px] tracking-wide text-[#B9AD99] transition hover:bg-white/5"
                    >
                      RETURN TO OVERVIEW
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* API ERROR */}
          {!loading && error && !workspaceUnavailable && (
            <div className="border border-red-500/30 bg-red-500/[0.045] p-6">
              <p className="text-sm font-semibold text-red-300">
                Evaluation data unavailable
              </p>
              <p className="mt-2 text-xs text-red-200/70">{error}</p>
              <button
                onClick={loadData}
                className="mt-4 border border-red-400/30 px-4 py-2 text-xs text-red-200 hover:bg-red-400/10"
              >
                Retry connection
              </button>
            </div>
          )}

          {/* DASHBOARD */}
          {!loading && !error && !workspaceUnavailable && summary && (
            <>
              {/* KPI CARDS */}
              <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  index="01"
                  label="Evaluated series"
                  value={number(summary.total_series).toLocaleString("en-IN")}
                  detail="Material-location combinations"
                  icon={<Target size={19} />}
                />

                <MetricCard
                  index="02"
                  label="Mean WAPE"
                  value={`${fmt(summary.mean_wape)}%`}
                  detail="Weighted absolute percentage error"
                  icon={<Activity size={19} />}
                />

                <MetricCard
                  index="03"
                  label="Mean MAE"
                  value={fmt(summary.mean_mae)}
                  detail="Mean absolute error"
                  icon={<TrendingUp size={19} />}
                />

                <MetricCard
                  index="04"
                  label="Mean RMSE"
                  value={fmt(summary.mean_rmse)}
                  detail="Root mean squared error"
                  icon={<BrainCircuit size={19} />}
                />
              </section>

              {/* MODEL COMPARISON + WINNER */}
              <section className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.65fr_1fr]">
                <Panel className="p-5 sm:p-6">
                  <PanelHeading
                    eyebrow="01 / MODEL BENCHMARKING"
                    title="Performance by Selected Model"
                    description="Compare average WAPE, MAE and RMSE across the models selected for each series."
                  />

                  <div className="h-[310px] w-full">
                    {modelComparison.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={modelComparison}
                          margin={{ top: 10, right: 12, left: -15, bottom: 5 }}
                        >
                          <CartesianGrid
                            stroke="#FFFFFF"
                            strokeOpacity={0.06}
                            vertical={false}
                          />
                          <XAxis
                            dataKey="model"
                            tickFormatter={labelize}
                            tick={axisStyle}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={axisStyle}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(value: any, name: any) => [
                              fmt(number(value)),
                              String(name),
                            ]}
                            labelFormatter={(label) =>
                              labelize(String(label))
                            }
                          />
                          <Bar
                            dataKey="averageWape"
                            name="Average WAPE"
                            fill={GOLD}
                            radius={[3, 3, 0, 0]}
                            barSize={32}
                          />
                          <Bar
                            dataKey="averageMae"
                            name="Average MAE"
                            fill={MUTED_GOLD}
                            radius={[3, 3, 0, 0]}
                            barSize={32}
                          />
                          <Bar
                            dataKey="averageRmse"
                            name="Average RMSE"
                            fill={LIGHT_GOLD}
                            radius={[3, 3, 0, 0]}
                            barSize={32}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart />
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-5 border-t border-white/[0.06] pt-4">
                    {[
                      ["Average WAPE", GOLD],
                      ["Average MAE", MUTED_GOLD],
                      ["Average RMSE", LIGHT_GOLD],
                    ].map(([name, color]) => (
                      <div key={name} className="flex items-center gap-2">
                        <span
                          className="h-2 w-2"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-[9px] text-[#A29784]">
                          {name}
                        </span>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel className="p-5 sm:p-6">
                  <PanelHeading
                    eyebrow="02 / MODEL SELECTION"
                    title="Validation Overview"
                    description="Summary of the current holdout evaluation."
                  />

                  <div className="border border-[#C9A362]/20 bg-[#C9A362]/[0.045] p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] tracking-[1.4px] text-[#96856A]">
                        LOWEST AVERAGE WAPE
                      </span>
                      <Gauge size={18} className="text-[#C9A362]" />
                    </div>

                    <p className="mt-4 text-[30px] font-medium capitalize tracking-tight text-[#E6C98E]">
                      {bestModel ? labelize(bestModel.model) : "—"}
                    </p>

                    <p className="mt-2 text-[11px] text-[#A79A84]">
                      {bestModel
                        ? `${fmt(bestModel.averageWape)}% average WAPE`
                        : "No model comparison available"}
                    </p>

                    {bestModel && (
                      <p className="mt-1 text-[9px] text-[#7F7464]">
                        Across {bestModel.series} selected series
                      </p>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="border border-white/[0.07] p-4">
                      <p className="text-[9px] tracking-wider text-[#827866]">
                        TEST PERIOD
                      </p>
                      <p className="mt-3 text-[22px] text-[#E6C98E]">
                        {summary.test_period_weeks}
                      </p>
                      <p className="mt-1 text-[9px] text-[#827866]">weeks</p>
                    </div>

                    <div className="border border-white/[0.07] p-4">
                      <p className="text-[9px] tracking-wider text-[#827866]">
                        FORECAST HORIZON
                      </p>
                      <p className="mt-3 text-[22px] text-[#E6C98E]">
                        {summary.forecast_horizon_weeks}
                      </p>
                      <p className="mt-1 text-[9px] text-[#827866]">weeks</p>
                    </div>

                    <div className="col-span-2 border border-white/[0.07] p-4">
                      <p className="text-[9px] tracking-wider text-[#827866]">
                        MEAN FORECAST BIAS
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-[24px] text-[#E6C98E]">
                          {fmt(summary.mean_bias)}%
                        </p>
                        {number(summary.mean_bias) > 0 ? (
                          <ArrowUpRight
                            size={20}
                            className="text-[#D5B477]"
                          />
                        ) : (
                          <ArrowDownRight
                            size={20}
                            className="text-[#D5B477]"
                          />
                        )}
                      </div>
                      <p className="mt-1 text-[9px] text-[#827866]">
                        Signed average bias as reported by the backend
                      </p>
                    </div>
                  </div>
                </Panel>
              </section>
                            {/* ERROR ANALYTICS */}
              <section className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
                <Panel className="p-5 sm:p-6">
                  <PanelHeading
                    eyebrow="03 / ERROR DISTRIBUTION"
                    title="Forecast Error Profile"
                    description="Number of evaluated series within each WAPE range."
                  />

                  <div className="h-[275px] w-full">
                    {records.some((r) => r.wape !== null) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={errorDistribution}
                          margin={{ top: 12, right: 10, left: -15, bottom: 5 }}
                        >
                          <CartesianGrid
                            stroke="#FFFFFF"
                            strokeOpacity={0.06}
                            vertical={false}
                          />
                          <XAxis
                            dataKey="range"
                            tick={axisStyle}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={axisStyle}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(value: any) => [
                              value,
                              "Evaluated series",
                            ]}
                          />
                          <Bar
                            dataKey="count"
                            name="Series"
                            fill={GOLD}
                            radius={[3, 3, 0, 0]}
                            barSize={36}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart />
                    )}
                  </div>
                </Panel>

                <Panel className="p-5 sm:p-6">
                  <PanelHeading
                    eyebrow="04 / ERROR RELATIONSHIP"
                    title="MAE vs RMSE"
                    description="Each point represents a material-location evaluation series."
                  />

                  <div className="h-[275px] w-full">
                    {scatterData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart
                          margin={{
                            top: 10,
                            right: 15,
                            left: 0,
                            bottom: 5,
                          }}
                        >
                          <CartesianGrid
                            stroke="#FFFFFF"
                            strokeOpacity={0.06}
                          />
                          <XAxis
                            type="number"
                            dataKey="mae"
                            name="MAE"
                            tick={axisStyle}
                            axisLine={false}
                            tickLine={false}
                            label={{
                              value: "MAE",
                              position: "insideBottom",
                              offset: -2,
                              fill: "#A99B82",
                              fontSize: 10,
                            }}
                          />
                          <YAxis
                            type="number"
                            dataKey="rmse"
                            name="RMSE"
                            tick={axisStyle}
                            axisLine={false}
                            tickLine={false}
                          />
                          <ZAxis range={[45, 45]} />
                          <Tooltip
                            cursor={{ strokeDasharray: "3 3" }}
                            contentStyle={tooltipStyle}
                            formatter={(value: any, name: any) => [
                              fmt(number(value)),
                              String(name),
                            ]}
                            labelFormatter={(_, payload) =>
                              payload?.[0]?.payload?.name ?? ""
                            }
                          />
                          <Scatter
                            name="Evaluation series"
                            data={scatterData}
                            fill={GOLD}
                            fillOpacity={0.8}
                          />
                        </ScatterChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart />
                    )}
                  </div>
                </Panel>
              </section>

              {/* CLASSIFICATION + BIAS */}
              <section className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
                <Panel className="p-5 sm:p-6">
                  <PanelHeading
                    eyebrow="05 / DEMAND INTELLIGENCE"
                    title="Demand Pattern Distribution"
                    description="Classification of evaluated material-location combinations."
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr] sm:items-center">
                    <div className="h-[240px]">
                      {classificationCounts.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={classificationCounts}
                              dataKey="count"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={62}
                              outerRadius={95}
                              paddingAngle={3}
                              stroke="#10100F"
                              strokeWidth={3}
                            >
                              {classificationCounts.map((item, index) => (
                                <Cell
                                  key={item.name}
                                  fill={
                                    chartColors[index % chartColors.length]
                                  }
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={tooltipStyle}
                              formatter={(value: any) => [
                                value,
                                "Series",
                              ]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyChart />
                      )}
                    </div>

                    <div className="space-y-4">
                      {classificationCounts.map((item, index) => {
                        const percentage =
                          records.length > 0
                            ? (item.count / records.length) * 100
                            : 0;

                        return (
                          <div key={item.name}>
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2 w-2 shrink-0"
                                  style={{
                                    backgroundColor:
                                      chartColors[index % chartColors.length],
                                  }}
                                />
                                <span className="text-[10px] capitalize text-[#C6B89E]">
                                  {item.name}
                                </span>
                              </div>
                              <span className="text-[10px] tabular-nums text-[#E6C98E]">
                                {item.count}
                              </span>
                            </div>
                            <div className="h-1 bg-white/[0.06]">
                              <div
                                className="h-full"
                                style={{
                                  width: `${percentage}%`,
                                  backgroundColor:
                                    chartColors[index % chartColors.length],
                                }}
                              />
                            </div>
                            <p className="mt-1 text-right text-[9px] text-[#827866]">
                              {fmt(percentage, 1)}%
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Panel>

                <Panel className="p-5 sm:p-6">
                  <PanelHeading
                    eyebrow="06 / MODEL DIAGNOSTICS"
                    title="Average Bias by Model"
                    description="Signed average bias across series assigned to each forecasting model."
                  />

                  <div className="h-[275px] w-full">
                    {biasByModel.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={biasByModel}
                          margin={{
                            top: 12,
                            right: 15,
                            left: -15,
                            bottom: 5,
                          }}
                        >
                          <CartesianGrid
                            stroke="#FFFFFF"
                            strokeOpacity={0.06}
                            vertical={false}
                          />
                          <XAxis
                            dataKey="model"
                            tickFormatter={labelize}
                            tick={axisStyle}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={axisStyle}
                            axisLine={false}
                            tickLine={false}
                          />
                          <ReferenceLine
                            y={0}
                            stroke="#A99B82"
                            strokeDasharray="4 4"
                          />
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(value: any) => [
                              `${fmt(number(value))}%`,
                              "Average bias",
                            ]}
                            labelFormatter={(label) =>
                              labelize(String(label))
                            }
                          />
                          <Bar
                            dataKey="bias"
                            name="Average bias"
                            fill={GOLD}
                            radius={[3, 3, 0, 0]}
                            barSize={38}
                          />
                          <Line
                            dataKey="bias"
                            stroke={LIGHT_GOLD}
                            strokeWidth={2}
                            dot={{
                              fill: LIGHT_GOLD,
                              stroke: "#10100F",
                              strokeWidth: 2,
                              r: 4,
                            }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart />
                    )}
                  </div>
                </Panel>
              </section>

              {/* EVALUATION TABLE */}
              <Panel className="p-5 sm:p-6">
                <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
                  <div>
                    <SectionLabel>
                      07 / SERIES-LEVEL MODEL RESULTS
                    </SectionLabel>
                    <h3 className="mt-2 text-[18px] font-semibold text-[#F0E5D1]">
                      Evaluation Records
                    </h3>
                    <p className="mt-1 text-[10px] text-[#8F8576]">
                      Inspect individual material-location model outcomes.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[9px] tracking-wider text-[#A68C5E]">
                    <Database size={13} />
                    {filteredRecords.length} / {records.length} RECORDS
                  </div>
                </div>

                {/* FILTERS */}
                <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="relative">
                    <Search
                      size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A835C]"
                    />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search material or location..."
                      className="w-full border border-[#C9A362]/20 bg-[#0B0B0A] py-3 pl-9 pr-3 text-[10px] text-[#E6D8C0] outline-none placeholder:text-[#655D50] focus:border-[#C9A362]/60"
                    />
                  </div>

                  <div className="relative">
                    <select
                      value={modelFilter}
                      onChange={(e) => setModelFilter(e.target.value)}
                      className={selectClass}
                    >
                      <option value="all">All models</option>
                      {models.map((model) => (
                        <option key={model} value={model}>
                          {labelize(model)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={12}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#A88B58]"
                    />
                  </div>

                  <div className="relative">
                    <select
                      value={classFilter}
                      onChange={(e) => setClassFilter(e.target.value)}
                      className={selectClass}
                    >
                      <option value="all">All demand patterns</option>
                      {classifications.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={12}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#A88B58]"
                    />
                  </div>

                  <div className="relative">
                    <select
                      value={locationFilter}
                      onChange={(e) => setLocationFilter(e.target.value)}
                      className={selectClass}
                    >
                      <option value="all">All locations</option>
                      {locations.map((location) => (
                        <option key={location} value={location}>
                          {location}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={12}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#A88B58]"
                    />
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[9px] text-[#827866]">
                    <Filter size={12} className="text-[#C9A362]" />
                    SORT RESULTS BY
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="border border-[#C9A362]/20 bg-[#0B0B0A] px-2 py-2 text-[9px] text-[#DCCBAE] outline-none"
                    >
                      <option value="wape">WAPE</option>
                      <option value="mae">MAE</option>
                      <option value="rmse">RMSE</option>
                      <option value="bias">Absolute bias</option>
                    </select>
                  </div>

                  {filterActive && (
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-1 text-[9px] text-[#D9B879] hover:text-[#F0D9A9]"
                    >
                      <X size={12} />
                      Clear filters
                    </button>
                  )}
                </div>

                {/* RESULTS */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[950px] text-left">
                    <thead>
                      <tr className="border-y border-[#C9A362]/20 bg-[#C9A362]/[0.035] text-[9px] tracking-wider text-[#A89167]">
                        <th className="px-4 py-4 font-medium">MATERIAL</th>
                        <th className="px-4 py-4 font-medium">LOCATION</th>
                        <th className="px-4 py-4 font-medium">PATTERN</th>
                        <th className="px-4 py-4 font-medium">MODEL</th>
                        <th className="px-4 py-4 text-right font-medium">
                          MAE
                        </th>
                        <th className="px-4 py-4 text-right font-medium">
                          RMSE
                        </th>
                        <th className="px-4 py-4 text-right font-medium">
                          WAPE
                        </th>
                        <th className="px-4 py-4 text-right font-medium">
                          BIAS
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredRecords.map((r, index) => (
                        <tr
                          key={`${r.item_code}-${r.location_code}-${index}`}
                          className="border-b border-white/[0.055] text-[10px] text-[#C9BDA8] transition hover:bg-[#C9A362]/[0.045]"
                        >
                          <td className="px-4 py-4 font-semibold text-[#E5D5B8]">
                            {r.item_code}
                          </td>
                          <td className="px-4 py-4 text-[#A99C86]">
                            {r.location_code}
                          </td>
                          <td className="px-4 py-4 capitalize">
                            {r.classification}
                          </td>
                          <td className="px-4 py-4 capitalize text-[#D9B879]">
                            {labelize(r.selected_model)}
                          </td>
                          <td className="px-4 py-4 text-right tabular-nums">
                            {fmt(r.mae)}
                          </td>
                          <td className="px-4 py-4 text-right tabular-nums">
                            {fmt(r.rmse)}
                          </td>
                          <td className="px-4 py-4 text-right tabular-nums text-[#E6C98E]">
                            {r.wape === null ? "—" : `${fmt(r.wape)}%`}
                          </td>
                          <td className="px-4 py-4 text-right tabular-nums">
                            {r.bias === null ? "—" : `${fmt(r.bias)}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredRecords.length === 0 && (
                    <div className="py-14 text-center">
                      <Search
                        size={22}
                        className="mx-auto mb-3 text-[#8D754D]"
                      />
                      <p className="text-[12px] text-[#C7B99F]">
                        No matching evaluation records
                      </p>
                      <p className="mt-1 text-[10px] text-[#776D5D]">
                        Try changing your filters.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-4 text-[9px] text-[#827866]">
                  <span>
                    Displaying {filteredRecords.length} of {records.length}{" "}
                    evaluation records
                  </span>
                  <span className="tracking-wider text-[#9A835C]">
                    SOURCE: ACTIVE DATASET FORECAST EVALUATION API
                  </span>
                </div>
              </Panel>

              {/* METRIC DEFINITIONS */}
              <section className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  [
                    "MAE",
                    "Mean Absolute Error",
                    "Measures the average magnitude of forecast errors without considering their direction.",
                  ],
                  [
                    "RMSE",
                    "Root Mean Squared Error",
                    "Penalizes larger forecast errors more heavily because the errors are squared.",
                  ],
                  [
                    "WAPE",
                    "Weighted Absolute Percentage Error",
                    "Measures total absolute forecast error relative to total actual demand.",
                  ],
                ].map(([short, title, description]) => (
                  <div
                    key={short}
                    className="border border-[#C9A362]/15 bg-[#10100F] p-4"
                  >
                    <p className="text-[10px] font-bold tracking-widest text-[#D6B576]">
                      {short}
                    </p>
                    <p className="mt-2 text-[11px] font-semibold text-[#E7DCC9]">
                      {title}
                    </p>
                    <p className="mt-2 text-[10px] leading-5 text-[#82796B]">
                      {description}
                    </p>
                  </div>
                ))}
              </section>

              {/* FOOTER */}
              <footer className="mt-8 flex flex-col justify-between gap-3 border-t border-[#C9A362]/15 py-6 text-[9px] tracking-wider text-[#827866] sm:flex-row">
                <p>Janus AI · PS000213 · GUJARAT · 2026</p>
                <span className="flex items-center gap-2 text-[#C9A362]">
                  <CheckCircle2 size={12} />
                  EVALUATION DATA LOADED
                </span>
              </footer>
            </>
          )}
        </div>
      </div>
    </main>
  );
}