"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ActiveDataSource from "@/components/active-data-source";
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  ArrowUpRight,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Factory,
  Gauge,
  Layers3,
  Loader2,
  Package,
  RefreshCw,
  ShieldAlert,
  Truck,
  Zap,
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

const API = "https://janus-ai-backend-j6bb.onrender.com/api";

type ScenarioType =
  | "demand_surge"
  | "supplier_delay"
  | "emergency_event"
  | "budget_constraint"
  | "supply_disruption";

type OptionItem = {
  value: string;
  label: string;
};

type ScenarioOptions = {
  materials?: any[];
  locations?: any[];
  suppliers?: any[];
  forecast_weeks?: any[];
};

type SimulationResult = {
  [key: string]: any;
};

const scenarios: {
  id: ScenarioType;
  title: string;
  description: string;
  detail: string;
  icon: any;
  color: string;
}[] = [
  {
    id: "demand_surge",
    title: "Demand Surge",
    description: "Simulate an unexpected increase in material demand.",
    detail: "Demand volatility",
    icon: ArrowUpRight,
    color: "#D8AE70",
  },
  {
    id: "supplier_delay",
    title: "Supplier Delay",
    description: "Model the impact of delayed purchase order arrivals.",
    detail: "Lead-time disruption",
    icon: Clock3,
    color: "#D9A66B",
  },
  {
    id: "emergency_event",
    title: "Emergency Event",
    description: "Inject additional demand for a specific material and location.",
    detail: "Emergency restoration",
    icon: Zap,
    color: "#E7C47F",
  },
  {
    id: "budget_constraint",
    title: "Budget Constraint",
    description: "Apply a procurement budget reduction and prioritise critical materials.",
    detail: "Capital allocation",
    icon: Gauge,
    color: "#C9A362",
  },
  {
    id: "supply_disruption",
    title: "Supply Disruption",
    description: "Remove outstanding purchase orders from a selected supplier.",
    detail: "Supplier risk",
    icon: Factory,
    color: "#C98C72",
  },
];

const number = (value: any): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumber = (value: any, digits = 2) =>
  number(value).toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });

const formatCurrency = (value: any) => {
  const amount = number(value);
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

const readArray = (source: any, keys: string[]): any[] => {
  for (const key of keys) {
    if (Array.isArray(source?.[key])) return source[key];
  }
  return [];
};

const readObject = (source: any, keys: string[]) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value;
    }
  }
  return {};
};

const getLabel = (item: any, fallback: string) =>
  String(
    item?.label ??
      item?.name ??
      item?.item_name ??
      item?.location_name ??
      item?.supplier_name ??
      item?.value ??
      item?.item_code ??
      item?.location_code ??
      item?.supplier_code ??
      fallback
  );

const getValue = (item: any, fallback: string) =>
  String(
    item?.value ??
      item?.code ??
      item?.item_code ??
      item?.location_code ??
      item?.supplier_code ??
      item?.id ??
      fallback
  );

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: OptionItem[];
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9B9386]">
        {label}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-xl border border-[#29251F] bg-[#11100E] px-4 py-3 pr-10 text-sm text-[#E9E0D2] outline-none transition focus:border-[#C9A362]"
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={15}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8F8679]"
        />
      </div>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  suffix,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9B9386]">
        {label}
      </span>
      <div className="flex items-center rounded-xl border border-[#29251F] bg-[#11100E] transition focus-within:border-[#C9A362]">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full min-w-0 bg-transparent px-4 py-3 text-sm text-[#F1E8D8] outline-none"
        />
        {suffix && (
          <span className="pr-4 text-xs text-[#81786B]">{suffix}</span>
        )}
      </div>
    </label>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  accent = "#C9A362",
}: {
  label: string;
  value: string;
  helper: string;
  icon: any;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#28241E] bg-[#100F0D] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#918879]">
            {label}
          </p>
          <p className="mt-3 text-[25px] font-semibold tracking-tight text-[#F0E7D9]">
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
      <p className="mt-3 text-xs text-[#81796D]">{helper}</p>
    </div>
  );
}

function SectionTitle({
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
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#C9A362]">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-[#EFE6D8]">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-[#827A6F]">{description}</p>
      )}
    </div>
  );
}

export default function ScenarioIntelligencePage() {
  const [options, setOptions] = useState<ScenarioOptions>({});
  const [activeDatasetType, setActiveDatasetType] = useState<string>("synthetic");
  const [activeDatasetName, setActiveDatasetName] = useState<string>("Synthetic Demo Dataset");
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");

  const [scenarioType, setScenarioType] =
    useState<ScenarioType>("demand_surge");
  const [demandIncrease, setDemandIncrease] = useState(25);
  const [delayDays, setDelayDays] = useState(10);
  const [itemCode, setItemCode] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [additionalDemand, setAdditionalDemand] = useState(5);
  const [eventWeek, setEventWeek] = useState("");
  const [budgetReduction, setBudgetReduction] = useState(20);
  const [supplierCode, setSupplierCode] = useState("");

  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastRun, setLastRun] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadActiveDataset = async () => {
      try {
        const response = await fetch(`${API}/data-intelligence/workspaces/active`);
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        setActiveDatasetType(String(data?.dataset_type ?? "synthetic").toLowerCase());
        setActiveDatasetName(String(data?.dataset_name ?? "Synthetic Demo Dataset"));
      } catch {
        // Keep the default synthetic label if the workspace endpoint is unavailable.
      }
    };

    loadActiveDataset();
    return () => {
      cancelled = true;
    };
  }, []);

  const isSynthetic = activeDatasetType !== "uploaded";
  const dataModeLabel = isSynthetic ? "Synthetic Demo" : "Uploaded Dataset";

  useEffect(() => {
    const loadOptions = async () => {
      try {
        setOptionsLoading(true);
        setOptionsError("");

        const response = await fetch(`${API}/scenarios/options`);
        if (!response.ok) {
          throw new Error(`Unable to load scenario options (${response.status})`);
        }

        const data = await response.json();
        setOptions(data);

        const materials = readArray(data, ["materials", "items"]);
        const locations = readArray(data, ["locations"]);
        const suppliers = readArray(data, ["suppliers"]);
        const weeks = readArray(data, ["forecast_weeks", "weeks"]);

        if (materials.length) setItemCode(getValue(materials[0], ""));
        if (locations.length) setLocationCode(getValue(locations[0], ""));
        if (suppliers.length) setSupplierCode(getValue(suppliers[0], ""));

        if (weeks.length) {
          const firstWeek =
            typeof weeks[0] === "string"
              ? weeks[0]
              : weeks[0]?.week_start ?? weeks[0]?.value ?? "";
          setEventWeek(String(firstWeek));
        }
      } catch (err: any) {
        setOptionsError(err?.message || "Unable to load scenario options.");
      } finally {
        setOptionsLoading(false);
      }
    };

    loadOptions();
  }, []);

  const materialOptions = useMemo(
    () =>
      readArray(options, ["materials", "items"]).map((item, index) => ({
        value: getValue(item, String(index)),
        label:
          item?.item_name && item?.item_code
            ? `${item.item_name} (${item.item_code})`
            : getLabel(item, `Material ${index + 1}`),
      })),
    [options]
  );

  const locationOptions = useMemo(
    () =>
      readArray(options, ["locations"]).map((item, index) => ({
        value: getValue(item, String(index)),
        label: getLabel(item, `Location ${index + 1}`),
      })),
    [options]
  );

  const supplierOptions = useMemo(
    () =>
      readArray(options, ["suppliers"]).map((item, index) => ({
        value: getValue(item, String(index)),
        label:
          item?.supplier_name && item?.supplier_code
            ? `${item.supplier_name} (${item.supplier_code})`
            : getLabel(item, `Supplier ${index + 1}`),
      })),
    [options]
  );

  const weekOptions = useMemo(
    () =>
      readArray(options, ["forecast_weeks", "weeks"])
        .map((week: any) => {
          const value =
            typeof week === "string"
              ? week
              : String(week?.week_start ?? week?.value ?? week?.date ?? "");
          return { value, label: value };
        })
        .filter((week) => week.value),
    [options]
  );

  const selectedScenario = scenarios.find((item) => item.id === scenarioType)!;

  const runSimulation = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    const payload: Record<string, any> = {
      scenario_type: scenarioType,
    };

    if (scenarioType === "demand_surge") {
      payload.demand_increase_pct = demandIncrease;
    }

    if (scenarioType === "supplier_delay") {
      payload.delay_days = delayDays;
    }

    if (scenarioType === "emergency_event") {
      payload.item_code = itemCode;
      payload.location_code = locationCode;
      payload.additional_demand = additionalDemand;
      if (eventWeek) payload.event_week = eventWeek;
    }

    if (scenarioType === "budget_constraint") {
      payload.budget_reduction_pct = budgetReduction;
    }

    if (scenarioType === "supply_disruption") {
      payload.supplier_code = supplierCode;
    }

    try {
      const response = await fetch(`${API}/scenarios/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || data?.message || `Simulation failed (${response.status})`
        );
      }

      setResult(data);
      setLastRun(new Date().toLocaleString("en-IN"));
    } catch (err: any) {
      setError(err?.message || "Unable to run this scenario.");
    } finally {
      setLoading(false);
    }
  };

  const scenarioSummary = useMemo(
    () =>
      readObject(result, [
        "scenario",
        "scenario_summary",
        "summary",
        "scenario_metrics",
      ]),
    [result]
  );

  const comparison = useMemo(
    () => readObject(result, ["comparison", "comparison_summary"]),
    [result]
  );

  const itemRows = useMemo(
    () =>
      readArray(result, [
        "scenario_item_location_summary",
        "item_location_summary",
        "item_location_results",
        "material_location_summary",
        "recommendations",
        "items",
        "results",
      ]),
    [result]
  );
    const baselineWeeklyRows = useMemo(
    () => readArray(result, ["baseline_weekly_projection"]),
    [result]
  );

  const scenarioWeeklyRows = useMemo(
    () => readArray(result, ["scenario_weekly_projection"]),
    [result]
  );

  const chartData = useMemo(() => {
    const weeklyMap = new Map<string, any>();

    const getWeek = (row: any) =>
      String(row.week_start ?? row.week ?? row.date ?? "");

    for (const row of baselineWeeklyRows) {
      const week = getWeek(row);
      if (!week) continue;

      if (!weeklyMap.has(week)) {
        weeklyMap.set(week, {
          week,
          baselineDemand: 0,
          scenarioDemand: 0,
          baselineStock: 0,
          scenarioStock: 0,
          baselineReceipts: 0,
          scenarioReceipts: 0,
          baselineUnmet: 0,
          scenarioUnmet: 0,
        });
      }

      const entry = weeklyMap.get(week)!;
      entry.baselineDemand += number(
        row.projected_demand ?? row.forecast_demand
      );
      entry.baselineStock += number(row.closing_stock);
      entry.baselineReceipts += number(row.scheduled_receipts);
      entry.baselineUnmet += number(row.unmet_demand);
    }

    for (const row of scenarioWeeklyRows) {
      const week = getWeek(row);
      if (!week) continue;

      if (!weeklyMap.has(week)) {
        weeklyMap.set(week, {
          week,
          baselineDemand: 0,
          scenarioDemand: 0,
          baselineStock: 0,
          scenarioStock: 0,
          baselineReceipts: 0,
          scenarioReceipts: 0,
          baselineUnmet: 0,
          scenarioUnmet: 0,
        });
      }

      const entry = weeklyMap.get(week)!;
      entry.scenarioDemand += number(row.projected_demand);
      entry.scenarioStock += number(row.closing_stock);
      entry.scenarioReceipts += number(row.scheduled_receipts);
      entry.scenarioUnmet += number(row.unmet_demand);
    }

    return Array.from(weeklyMap.values()).sort((a, b) =>
      a.week.localeCompare(b.week)
    );
  }, [baselineWeeklyRows, scenarioWeeklyRows]);

  const assumptions = useMemo(
    () => readArray(result, ["assumptions"]),
    [result]
  );

  const metrics = [
    {
      label: "Projected demand",
      key: "total_projected_demand",
      icon: Activity,
      helper: "Demand across the simulation horizon",
    },
    {
      label: "Unmet demand",
      key: "total_unmet_demand",
      icon: AlertTriangle,
      helper: "Demand that could not be fulfilled",
      accent: "#D68C70",
    },
    {
      label: "Stockout exposure",
      key: "stockout_item_location_weeks",
      icon: ShieldAlert,
      helper: "Item-location weeks with stockouts",
      accent: "#D68C70",
    },
    {
      label: "Procurement requirement",
      key: "recommended_procurement_quantity",
      icon: Package,
      helper: "Recovery plus replenishment quantity",
    },
    {
      label: "Estimated procurement cost",
      key: "estimated_procurement_cost",
      icon: Gauge,
      helper: "Estimated cost of recommended procurement",
    },
    {
      label: "Scheduled receipts",
      key: "total_scheduled_receipts",
      icon: Truck,
      helper: "Purchase orders expected within the horizon",
    },
  ];

  const getMetric = (key: string) => {
    const sources = [scenarioSummary, result, comparison];
    for (const source of sources) {
      if (source && source[key] !== undefined) return source[key];
    }
    return 0;
  };

  const displayedRows = [...itemRows].sort(
    (a: any, b: any) =>
      number(b.total_unmet_demand) - number(a.total_unmet_demand)
  );

  return (
    <div className="min-h-screen bg-[#080807] text-[#F1E8D8]">
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
                label: "Forecasting",
                href: "/dashboard/forecasting",
                icon: Activity,
              },
              {
                label: "Inventory",
                href: "/dashboard/inventory",
                icon: Boxes,
              },
              {
                label: "Supplier Intelligence",
                href: "/dashboard/suppliers",
                icon: Truck,
              },
              {
                label: "Scenario Intelligence",
                href: "/dashboard/scenarios",
                icon: ArrowLeftRight,
                active: true,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[12px] transition ${
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
            <div className="flex items-center gap-2 text-[#C9A362]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C9A362]" />
              <span className="text-[9px] font-bold uppercase tracking-[0.17em]">
                Prototype environment
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-[#82796C]">
              Scenario outputs use the active {dataModeLabel.toLowerCase()} source.
            </p>
          </div>
        </div>
      </aside>

      <main className="min-h-screen lg:pl-[250px]">
        <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b border-[#211E19] bg-[#080807]/95 px-5 backdrop-blur-xl sm:px-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.19em] text-[#8B8172]">
              Janus AI / Decision support
            </p>
            <p className="mt-1 text-sm font-medium text-[#EDE3D3]">
              Scenario Intelligence
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#30291F] bg-[#100F0D] px-3 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C9A362]" />
            <span className="text-[10px] text-[#B9AC97]">{dataModeLabel}</span>
          </div>
        </header>

        <div className="mx-auto max-w-[1600px] px-5 py-8 sm:px-8 lg:px-10">
          <div className="mb-6">
            <ActiveDataSource workspace="scenarios" />
          </div>
          <div className="mb-8 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#C9A362]">
                <span className="h-px w-7 bg-[#C9A362]" />
                Predictive decision laboratory
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[#F2E9DC] sm:text-[38px]">
                Scenario <span className="text-[#C9A362]">Intelligence</span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#918879]">
                Stress-test material availability, supplier reliability, and
                procurement decisions before disruptions affect utility operations.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#82796D]">
              <CalendarDays size={15} className="text-[#C9A362]" />
              12-week forecast horizon
            </div>
          </div>

          <section className="mb-8">
            <SectionTitle
              eyebrow="01 / Scenario library"
              title="Choose a disruption scenario"
              description="Select a scenario to configure its parameters and model its operational impact."
            />
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-5">
              {scenarios.map((scenario) => {
                const Icon = scenario.icon;
                const active = scenarioType === scenario.id;

                return (
                  <button
                    key={scenario.id}
                    onClick={() => {
                      setScenarioType(scenario.id);
                      setError("");
                      setResult(null);
                    }}
                    className={`group rounded-2xl border p-4 text-left transition duration-200 ${
                      active
                        ? "border-[#C9A362]/60 bg-[#17130D] shadow-[0_0_28px_rgba(201,163,98,0.07)]"
                        : "border-[#28241E] bg-[#100F0D] hover:border-[#655239] hover:bg-[#14120F]"
                    }`}
                  >
                    <div className="mb-5 flex items-center justify-between">
                      <div
                        className="rounded-xl border p-2.5"
                        style={{
                          color: scenario.color,
                          borderColor: `${scenario.color}40`,
                          background: `${scenario.color}12`,
                        }}
                      >
                        <Icon size={18} />
                      </div>
                      {active && (
                        <CheckCircle2 size={17} className="text-[#C9A362]" />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[#EDE4D7]">
                      {scenario.title}
                    </p>
                    <p className="mt-2 min-h-[54px] text-[11px] leading-[18px] text-[#8B8275]">
                      {scenario.description}
                    </p>
                    <p className="mt-4 border-t border-[#29241D] pt-3 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#B09262]">
                      {scenario.detail}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mb-8">
            <div className="grid gap-5 xl:grid-cols-[1fr_330px]">
              <div className="rounded-2xl border border-[#2B261F] bg-[#100F0D] p-5 sm:p-7">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C9A362]">
                      02 / Scenario configuration
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-[#F0E7D9]">
                      {selectedScenario.title}
                    </h2>
                    <p className="mt-1 text-xs text-[#82796D]">
                      Configure the variables used by the simulation engine.
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#3A3021] bg-[#1A160F] p-3 text-[#C9A362]">
                    {(() => {
                      const Icon = selectedScenario.icon;
                      return <Icon size={20} />;
                    })()}
                  </div>
                </div>

                {optionsLoading && (
                  <div className="mb-5 flex items-center gap-2 text-xs text-[#9B907F]">
                    <Loader2 size={14} className="animate-spin text-[#C9A362]" />
                    Loading available materials, locations, and suppliers…
                  </div>
                )}

                {optionsError && (
                  <div className="mb-5 rounded-xl border border-[#75483C]/50 bg-[#241510] p-3 text-xs text-[#E0A18D]">
                    {optionsError}
                  </div>
                )}

                <div className="grid gap-5 sm:grid-cols-2">
                  {scenarioType === "demand_surge" && (
                    <NumberField
                      label="Demand increase"
                      value={demandIncrease}
                      onChange={setDemandIncrease}
                      min={0}
                      max={300}
                      suffix="%"
                    />
                  )}

                  {scenarioType === "supplier_delay" && (
                    <NumberField
                      label="Additional supplier delay"
                      value={delayDays}
                      onChange={setDelayDays}
                      min={0}
                      max={180}
                      suffix="days"
                    />
                  )}

                  {scenarioType === "emergency_event" && (
                    <>
                      <SelectField
                        label="Material"
                        value={itemCode}
                        onChange={setItemCode}
                        options={materialOptions}
                        placeholder="Select material"
                      />
                      <SelectField
                        label="Affected location"
                        value={locationCode}
                        onChange={setLocationCode}
                        options={locationOptions}
                        placeholder="Select location"
                      />
                      <NumberField
                        label="Additional emergency demand"
                        value={additionalDemand}
                        onChange={setAdditionalDemand}
                        min={0}
                        step={0.5}
                        suffix="units"
                      />
                      <SelectField
                        label="Event week"
                        value={eventWeek}
                        onChange={setEventWeek}
                        options={weekOptions}
                        placeholder="Select forecast week"
                      />
                    </>
                  )}

                  {scenarioType === "budget_constraint" && (
                    <NumberField
                      label="Budget reduction"
                      value={budgetReduction}
                      onChange={setBudgetReduction}
                      min={0}
                      max={100}
                      suffix="%"
                    />
                  )}

                  {scenarioType === "supply_disruption" && (
                    <SelectField
                      label="Disrupted supplier"
                      value={supplierCode}
                      onChange={setSupplierCode}
                      options={supplierOptions}
                      placeholder="Select supplier"
                    />
                  )}
                </div>

                <div className="mt-7 flex flex-col gap-3 border-t border-[#29241D] pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-md text-[11px] leading-5 text-[#81786C]">
                    The simulation compares the selected scenario against the
                    same baseline stock snapshot and forecast horizon.
                  </p>
                  <button
                    onClick={runSimulation}
                    disabled={
                      loading ||
                      optionsLoading ||
                      (scenarioType === "emergency_event" &&
                        (!itemCode || !locationCode)) ||
                      (scenarioType === "supply_disruption" && !supplierCode)
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C9A362] px-6 py-3 text-xs font-bold text-[#17120A] transition hover:bg-[#E0BD7D] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Running simulation…
                      </>
                    ) : (
                      <>
                        <Activity size={15} />
                        Run scenario simulation
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-[#2B261F] bg-[#100F0D] p-5 sm:p-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C9A362]">
                  Simulation scope
                </p>
                <div className="mt-5 space-y-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-[#C9A362]/10 p-2 text-[#C9A362]">
                      <Package size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#E7DDCE]">
                        {options.materials?.length ?? 20} materials
                      </p>
                      <p className="mt-1 text-[11px] text-[#81786D]">
                        Material-level demand and inventory positions
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-[#C9A362]/10 p-2 text-[#C9A362]">
                      <Factory size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#E7DDCE]">
                        {options.locations?.length ?? 5} utility locations
                      </p>
                      <p className="mt-1 text-[11px] text-[#81786D]">
                        Location-specific stock and demand impact
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-[#C9A362]/10 p-2 text-[#C9A362]">
                      <Truck size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#E7DDCE]">
                        {options.suppliers?.length ?? 8} suppliers
                      </p>
                      <p className="mt-1 text-[11px] text-[#81786D]">
                        Purchase order and supplier disruption modelling
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-[#C9A362]/10 p-2 text-[#C9A362]">
                      <CalendarDays size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#E7DDCE]">
                        {options.forecast_weeks?.length ?? 12}-week horizon
                      </p>
                      <p className="mt-1 text-[11px] text-[#81786D]">
                        Forward-looking inventory projections
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-7 rounded-xl border border-[#3A3021] bg-[#17130D] p-4">
                  <div className="flex items-center gap-2 text-[#D6B77F]">
                    <ShieldAlert size={15} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em]">
                      Model assumptions
                    </span>
                  </div>
                  <ul className="mt-3 space-y-2 text-[11px] leading-5 text-[#9A907F]">
                    <li>• Uses the latest available inventory snapshot.</li>
                    <li>• Existing purchase orders are considered by expected arrival date.</li>
                    <li>• New procurement recommendations are not treated as received stock.</li>
                    <li>• Outputs are simulated using the currently active dataset: {activeDatasetName}.</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {error && (
                        <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#75483C]/50 bg-[#241510] p-4 text-sm text-[#E0A18D]">
              <AlertTriangle size={17} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {result && (
            <section className="space-y-8">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <div>
                  <SectionTitle
                    eyebrow="03 / Simulation results"
                    title={`${selectedScenario.title} impact`}
                    description="Projected operational impact across the selected 12-week horizon."
                  />
                </div>
                {lastRun && (
                  <p className="mb-5 text-[10px] text-[#81786D]">
                    Last simulated: {lastRun}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {metrics.map((metric) => {
                  const value = getMetric(metric.key);
                  const isCost = metric.key === "estimated_procurement_cost";
                  const isStockout =
                    metric.key === "stockout_item_location_weeks";

                  return (
                    <MetricCard
                      key={metric.key}
                      label={metric.label}
                      value={
                        isCost
                          ? formatCurrency(value)
                          : formatNumber(value, isStockout ? 0 : 2)
                      }
                      helper={metric.helper}
                      icon={metric.icon}
                      accent={metric.accent}
                    />
                  );
                })}
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <div className="rounded-2xl border border-[#2B261F] bg-[#100F0D] p-5 sm:p-6">
                  <SectionTitle
                    eyebrow="04 / Operational impact"
                    title="Baseline vs scenario"
                    description="Compare the selected scenario with the original forecast."
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-[#29251F] bg-[#0B0A09] p-4">
                      <p className="text-[10px] uppercase tracking-wider text-[#82796D]">
                        Baseline unmet demand
                      </p>
                      <p className="mt-2 text-xl font-semibold text-[#C4B9A7]">
                        {formatNumber(
                          readObject(result, ["baseline"]).total_unmet_demand
                        )}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#493026] bg-[#1B100D] p-4">
                      <p className="text-[10px] uppercase tracking-wider text-[#B78A76]">
                        Scenario unmet demand
                      </p>
                      <p className="mt-2 text-xl font-semibold text-[#E0A18D]">
                        {formatNumber(
                          scenarioSummary.total_unmet_demand ??
                            getMetric("total_unmet_demand")
                        )}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#29251F] bg-[#0B0A09] p-4">
                      <p className="text-[10px] uppercase tracking-wider text-[#82796D]">
                        Baseline closing stock
                      </p>
                      <p className="mt-2 text-xl font-semibold text-[#C4B9A7]">
                        {formatNumber(
                          readObject(result, ["baseline"]).projected_closing_stock
                        )}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#304033] bg-[#101710] p-4">
                      <p className="text-[10px] uppercase tracking-wider text-[#8FA68E]">
                        Scenario closing stock
                      </p>
                      <p className="mt-2 text-xl font-semibold text-[#A8C0A6]">
                        {formatNumber(
                          scenarioSummary.projected_closing_stock
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#2B261F] bg-[#100F0D] p-5 sm:p-6">
                  <SectionTitle
                    eyebrow="05 / Procurement response"
                    title="Recovery and replenishment"
                    description="Recommended procurement is separated into demand recovery and stock replenishment."
                  />

                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="text-[#B8AA98]">Recovery quantity</span>
                        <span className="font-semibold text-[#E0A18D]">
                          {formatNumber(
                            scenarioSummary.total_recovery_quantity ??
                              getMetric("total_recovery_quantity")
                          )}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#29221D]">
                        <div
                          className="h-full rounded-full bg-[#C98770]"
                          style={{
                            width: `${
                              number(
                                scenarioSummary.recommended_procurement_quantity
                              ) > 0
                                ? Math.min(
                                    100,
                                    (number(
                                      scenarioSummary.total_recovery_quantity
                                    ) /
                                      number(
                                        scenarioSummary.recommended_procurement_quantity
                                      )) *
                                      100
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="text-[#B8AA98]">Replenishment quantity</span>
                        <span className="font-semibold text-[#E6C98E]">
                          {formatNumber(
                            scenarioSummary.total_replenishment_quantity ??
                              getMetric("total_replenishment_quantity")
                          )}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#29221D]">
                        <div
                          className="h-full rounded-full bg-[#C9A362]"
                          style={{
                            width: `${
                              number(
                                scenarioSummary.recommended_procurement_quantity
                              ) > 0
                                ? Math.min(
                                    100,
                                    (number(
                                      scenarioSummary.total_replenishment_quantity
                                    ) /
                                      number(
                                        scenarioSummary.recommended_procurement_quantity
                                      )) *
                                      100
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#393127] bg-[#0B0A09] p-4">
                      <p className="text-[10px] uppercase tracking-wider text-[#82796D]">
                        Total recommended procurement
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-[#E6C98E]">
                        {formatNumber(
                          getMetric("recommended_procurement_quantity")
                        )}
                      </p>
                      <p className="mt-1 text-xs text-[#81786D]">
                        Estimated cost:{" "}
                        {formatCurrency(getMetric("estimated_procurement_cost"))}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#2B261F] bg-[#100F0D] p-5 sm:p-6">
                <SectionTitle
                  eyebrow="06 / Weekly projection"
                  title="Demand and closing stock trajectory"
                  description="Aggregated weekly values across all materials and utility locations."
                />

                {chartData.length > 0 ? (
                  <div className="h-[360px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartData}
                        margin={{ top: 10, right: 12, left: 0, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient
                            id="scenarioDemandFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#C9A362"
                              stopOpacity={0.25}
                            />
                            <stop
                              offset="95%"
                              stopColor="#C9A362"
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="scenarioStockFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#789B83"
                              stopOpacity={0.2}
                            />
                            <stop
                              offset="95%"
                              stopColor="#789B83"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>

                        <CartesianGrid
                          stroke="#29251F"
                          strokeDasharray="3 5"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="week"
                          tick={{ fill: "#8D8375", fontSize: 10 }}
                          axisLine={{ stroke: "#373027" }}
                          tickLine={false}
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
                          formatter={(value: any) => formatNumber(value)}
                        />
                        <Legend
                          wrapperStyle={{
                            color: "#B5A994",
                            fontSize: 11,
                            paddingTop: 12,
                          }}
                        />

                        <Area
                          type="monotone"
                          dataKey="scenarioDemand"
                          name="Scenario demand"
                          stroke="#C9A362"
                          strokeWidth={2}
                          fill="url(#scenarioDemandFill)"
                          connectNulls
                        />
                        <Area
                          type="monotone"
                          dataKey="baselineDemand"
                          name="Baseline demand"
                          stroke="#77716A"
                          strokeWidth={1.5}
                          strokeDasharray="5 4"
                          fill="transparent"
                          connectNulls
                        />
                        <Area
                          type="monotone"
                          dataKey="scenarioStock"
                          name="Scenario closing stock"
                          stroke="#789B83"
                          strokeWidth={2}
                          fill="url(#scenarioStockFill)"
                          connectNulls
                        />
                        <Area
                          type="monotone"
                          dataKey="baselineStock"
                          name="Baseline closing stock"
                          stroke="#7D8797"
                          strokeWidth={1.5}
                          strokeDasharray="5 4"
                          fill="transparent"
                          connectNulls
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex min-h-[190px] flex-col items-center justify-center rounded-xl border border-dashed border-[#393127] bg-[#0C0B09] px-5 text-center">
                    <Activity size={22} className="text-[#9B8053]" />
                    <p className="mt-3 text-sm font-medium text-[#D7CBB9]">
                      Weekly projection data is unavailable
                    </p>
                    <p className="mt-1 max-w-md text-xs leading-5 text-[#81786D]">
                      This simulation response did not include the baseline and
                      scenario weekly projection arrays.
                    </p>
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#2B261F] bg-[#100F0D]">
                <div className="flex flex-col justify-between gap-2 border-b border-[#29241D] p-5 sm:flex-row sm:items-end sm:px-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C9A362]">
                      07 / Material-level impact
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-[#EFE6D8]">
                      Item-location breakdown
                    </h2>
                    <p className="mt-1 text-xs text-[#81786D]">
                      Stock, unmet demand, and procurement requirements by material and location.
                    </p>
                  </div>
                  <span className="text-[10px] text-[#8C8274]">
                    {displayedRows.length} records
                  </span>
                </div>

                {displayedRows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1050px] text-left">
                      <thead className="bg-[#15130F]">
                        <tr className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[#938878]">
                          <th className="px-5 py-4">Material</th>
                          <th className="px-4 py-4">Location</th>
                          <th className="px-4 py-4 text-right">Demand</th>
                          <th className="px-4 py-4 text-right">Receipts</th>
                          <th className="px-4 py-4 text-right">Unmet</th>
                          <th className="px-4 py-4 text-right">Closing stock</th>
                          <th className="px-4 py-4 text-right">Stockout weeks</th>
                          <th className="px-5 py-4 text-right">Procurement</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedRows.map((row: any, index: number) => (
                          <tr
                            key={`${row.item_code}-${row.location_code}-${index}`}
                            className="border-t border-[#25211B] text-xs transition hover:bg-[#17140F]"
                          >
                            <td className="px-5 py-4">
                              <p className="font-medium text-[#E4D9C9]">
                                {row.item_name ??
                                  row.material_name ??
                                  row.item_code ??
                                  "—"}
                              </p>
                              <p className="mt-1 text-[10px] text-[#80776A]">
                                {row.item_code ?? ""}
                              </p>
                            </td>
                            <td className="px-4 py-4 text-[#B5A994]">
                              {row.location_code ?? row.location_name ?? "—"}
                            </td>
                            <td className="px-4 py-4 text-right tabular-nums text-[#D9CFBF]">
                              {formatNumber(row.total_projected_demand)}
                            </td>
                            <td className="px-4 py-4 text-right tabular-nums text-[#B8AA92]">
                              {formatNumber(row.total_scheduled_receipts)}
                            </td>
                            <td className="px-4 py-4 text-right tabular-nums">
                              <span
                                className={
                                  number(row.total_unmet_demand) > 0
                                    ? "font-semibold text-[#D99578]"
                                    : "text-[#8FA68E]"
                                }
                              >
                                {formatNumber(row.total_unmet_demand)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right tabular-nums text-[#D9CFBF]">
                              {formatNumber(row.projected_closing_stock)}
                            </td>
                            <td className="px-4 py-4 text-right tabular-nums text-[#B5A994]">
                              {formatNumber(row.stockout_weeks, 0)}
                            </td>
                            <td className="px-5 py-4 text-right">
                              <p className="font-semibold tabular-nums text-[#E6C98E]">
                                {formatNumber(
                                  row.recommended_procurement_quantity
                                )}
                              </p>
                              <p className="mt-1 text-[10px] text-[#81786D]">
                                {formatCurrency(row.estimated_procurement_cost)}
                              </p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-[#81786D]">
                    Item-location details are not available in this response.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[#2B261F] bg-[#100F0D] p-5 sm:p-6">
                <SectionTitle
                  eyebrow="08 / Transparency"
                  title="Simulation assumptions"
                  description="Important context for interpreting the generated results."
                />
                {assumptions.length > 0 ? (
                  <ul className="space-y-3">
                    {assumptions.map((assumption: any, index: number) => (
                      <li
                        key={index}
                        className="flex items-start gap-3 text-xs leading-5 text-[#B0A493]"
                      >
                        <CheckCircle2
                          size={15}
                          className="mt-0.5 shrink-0 text-[#C9A362]"
                        />
                        <span>
                          {typeof assumption === "string"
                            ? assumption
                            : assumption?.description ??
                              assumption?.text ??
                              JSON.stringify(assumption)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs leading-5 text-[#918879]">
                    Results are generated using {activeDatasetName} and
                    represent a simulated planning scenario, not verified
                    GUVNL operational outcomes.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-[#3A3021] bg-[#17130D] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <ShieldAlert size={17} className="mt-0.5 shrink-0 text-[#C9A362]" />
                  <p className="text-[11px] leading-5 text-[#A99D8B]">
                    Prototype disclosure: displayed results are simulated using
                    {activeDatasetName}. {isSynthetic ? "This is synthetic demonstration data." : "This is user-uploaded data and has not been independently verified."} They should not be interpreted as
                    verified utility forecasts or actual procurement savings.
                  </p>
                </div>
                <button
                  onClick={runSimulation}
                  disabled={loading || optionsLoading}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[#4A3C27] px-4 py-2.5 text-xs font-semibold text-[#DCC18F] transition hover:bg-[#2A2114] disabled:opacity-50"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                  Run again
                </button>
              </div>
            </section>
          )}

          {!result && !loading && !error && (
            <div className="rounded-2xl border border-dashed border-[#393127] bg-[#0D0C0A] px-6 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#3A3021] bg-[#17130D] text-[#C9A362]">
                <Activity size={21} />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-[#E7DDCE]">
                Ready to simulate
              </h3>
              <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-[#81786D]">
                Choose one of the five scenarios, configure its parameters, and
                run the simulation to explore its potential impact on material
                availability and procurement.
              </p>
            </div>
          )}

          {loading && (
            <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-[#393127] bg-[#100F0D]">
              <Loader2 size={25} className="animate-spin text-[#C9A362]" />
              <p className="mt-4 text-sm font-medium text-[#E7DDCE]">
                Running scenario simulation
              </p>
              <p className="mt-1 text-xs text-[#81786D]">
                Calculating weekly demand, inventory impact, and procurement requirements…
              </p>
            </div>
          )}

          <footer className="mt-10 border-t border-[#211E19] py-6 text-center text-[10px] text-[#625B51]">
            Janus AI · Scenario Intelligence · {dataModeLabel} environment
          </footer>
        </div>
      </main>
    </div>
  );
}