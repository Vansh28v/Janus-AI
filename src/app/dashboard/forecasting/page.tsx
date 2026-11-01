"use client";

import { useEffect, useMemo, useState } from "react";
import ActiveDataSource from "@/components/active-data-source";
import {
  ArrowLeft,
  BrainCircuit,
  CalendarDays,
  Database,
  MapPin,
  Package,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Forecast = {
  week_start: string;
  item_code: string;
  location_code: string;
  forecast_quantity: number;
  selected_model: string;
  classification: string;
  source: string;
};

type HistoricalRecord = {
  week_start: string;
  item_code: string;
  location_code: string;
  quantity_consumed: number;
  is_spike: boolean;
  source: string;
};

type ForecastResponse = {
  total_records: number;
  returned_records: number;
  filters: {
    item_code: string | null;
    location_code: string | null;
  };
  data: Forecast[];
};

type HistoricalResponse = {
  total_records: number;
  returned_records: number;
  data: HistoricalRecord[];
};

const API_URL = "http://localhost:8000";

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(value);

const formatWeek = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });

export default function ForecastingPage() {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [history, setHistory] = useState<HistoricalRecord[]>([]);

  const [selectedItem, setSelectedItem] = useState("ALL");
  const [selectedLocation, setSelectedLocation] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadForecasts() {
    setLoading(true);
    setError("");

    try {
      const [forecastResponse, historyResponse] = await Promise.all([
        fetch(`${API_URL}/api/forecasts?limit=5000`),
        fetch(`${API_URL}/api/forecasts/history?limit=20000`),
      ]);

      if (!forecastResponse.ok) {
        throw new Error(
          `Forecast API returned ${forecastResponse.status}`
        );
      }

      if (!historyResponse.ok) {
        throw new Error(
          `Historical API returned ${historyResponse.status}`
        );
      }

      const forecastResult: ForecastResponse =
        await forecastResponse.json();

      const historyResult: HistoricalResponse =
        await historyResponse.json();

      if (!Array.isArray(forecastResult.data)) {
        throw new Error("Unexpected forecast API response.");
      }

      if (!Array.isArray(historyResult.data)) {
        throw new Error("Unexpected historical API response.");
      }

      setForecasts(forecastResult.data);
      setHistory(historyResult.data);

      console.log("FORECAST RECORDS:", forecastResult.data.length);
      console.log("HISTORICAL RECORDS:", historyResult.data.length);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load forecasting data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadForecasts();
  }, []);

  const materials = useMemo(
    () =>
      [
        ...new Set([
          ...forecasts.map((row) => row.item_code),
          ...history.map((row) => row.item_code),
        ]),
      ].sort(),
    [forecasts, history]
  );

  const locations = useMemo(
    () =>
      [
        ...new Set([
          ...forecasts.map((row) => row.location_code),
          ...history.map((row) => row.location_code),
        ]),
      ].sort(),
    [forecasts, history]
  );

  const filteredForecasts = useMemo(() => {
    return forecasts
      .filter(
        (row) =>
          (selectedItem === "ALL" ||
            row.item_code === selectedItem) &&
          (selectedLocation === "ALL" ||
            row.location_code === selectedLocation)
      )
      .sort((a, b) => a.week_start.localeCompare(b.week_start));
  }, [forecasts, selectedItem, selectedLocation]);

  const filteredHistory = useMemo(() => {
    return history
      .filter(
        (row) =>
          (selectedItem === "ALL" ||
            row.item_code === selectedItem) &&
          (selectedLocation === "ALL" ||
            row.location_code === selectedLocation)
      )
      .sort((a, b) => a.week_start.localeCompare(b.week_start));
  }, [history, selectedItem, selectedLocation]);

  const totalForecast = filteredForecasts.reduce(
    (sum, row) => sum + Number(row.forecast_quantity),
    0
  );

  const totalHistorical = filteredHistory.reduce(
    (sum, row) => sum + Number(row.quantity_consumed),
    0
  );

  const averageForecast =
    filteredForecasts.length > 0
      ? totalForecast / filteredForecasts.length
      : 0;

  const selectedModel =
    filteredForecasts[0]?.selected_model ?? "—";

  const classification =
    filteredForecasts[0]?.classification ?? "—";

  const forecastStart =
    filteredForecasts.length > 0
      ? filteredForecasts.reduce(
          (earliest, row) =>
            row.week_start < earliest ? row.week_start : earliest,
          filteredForecasts[0].week_start
        )
      : "";

  const chartData = useMemo(() => {
    const weeklyData = new Map<
      string,
      { actual: number | null; predicted: number | null }
    >();

    filteredHistory.forEach((row) => {
      const current = weeklyData.get(row.week_start) ?? {
        actual: null,
        predicted: null,
      };

      current.actual =
        (current.actual ?? 0) + Number(row.quantity_consumed);

      weeklyData.set(row.week_start, current);
    });

    filteredForecasts.forEach((row) => {
      const current = weeklyData.get(row.week_start) ?? {
        actual: null,
        predicted: null,
      };

      current.predicted =
        (current.predicted ?? 0) + Number(row.forecast_quantity);

      weeklyData.set(row.week_start, current);
    });

    return Array.from(weeklyData.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, values]) => ({
                week: formatWeek(date),
        fullDate: date,
        actual:
          values.actual !== null
            ? Number(values.actual.toFixed(2))
            : null,
        predicted:
          values.predicted !== null
            ? Number(values.predicted.toFixed(2))
            : null,
      }));
  }, [filteredHistory, filteredForecasts]);

  return (
    <div className="min-h-screen bg-black text-[#F1E8D8]">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#332A1B] bg-black/95 px-6 py-5 backdrop-blur">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#C49A55]">
            JANUS AI/ INTELLIGENCE
          </p>

          <h1 className="mt-1 text-xl font-semibold">
            Demand Forecasting
          </h1>
        </div>

        <a
          href="/dashboard"
          className="flex items-center gap-2 border border-[#55401F] px-4 py-2 text-sm text-[#E6C98E] transition hover:bg-[#211A10]"
        >
          <ArrowLeft size={16} />
          Overview
        </a>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-8 px-6 py-10">
        <section>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#C49A55]">
            Predictive analytics
          </p>

          <h2 className="font-[var(--font-cormorant)] text-5xl leading-tight md:text-6xl">
            Understand demand.
            <br />
            <span className="italic text-[#E6C98E]">
              Prepare ahead.
            </span>
          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#A69A85]">
            Explore AI-generated material demand forecasts across utility
            locations, with historical consumption, model selection and
            demand-pattern insights.
          </p>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4 border border-[#4A3820] bg-[#17130D] p-4">
          <ActiveDataSource workspace="forecasting" />

          <button
            onClick={loadForecasts}
            disabled={loading}
            className="flex items-center gap-2 border border-[#55401F] px-4 py-2 text-sm text-[#E6C98E] hover:bg-[#292012] disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={loading ? "animate-spin" : ""}
            />
            Refresh data
          </button>
        </section>

        {error && (
          <div className="border border-red-900 bg-red-950/30 p-4 text-sm text-red-300">
            {error}

            <p className="mt-2 text-xs">
              Check that the FastAPI backend is running on port 8000
              and that the active dataset has been normalized and forecast outputs are available.
            </p>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2">
          <div className="border border-[#332A1B] bg-[#101010] p-5">
            <label className="mb-3 block text-xs uppercase tracking-widest text-[#A69A85]">
              <Package className="mr-2 inline" size={14} />
              Select material
            </label>

            <select
              value={selectedItem}
              onChange={(event) => setSelectedItem(event.target.value)}
              className="w-full border border-[#55401F] bg-[#17130D] p-3 text-sm text-[#F1E8D8] outline-none focus:border-[#E6C98E]"
            >
              <option value="ALL">All materials</option>

              {materials.map((material) => (
                <option key={material} value={material}>
                  {material}
                </option>
              ))}
            </select>
          </div>

          <div className="border border-[#332A1B] bg-[#101010] p-5">
            <label className="mb-3 block text-xs uppercase tracking-widest text-[#A69A85]">
              <MapPin className="mr-2 inline" size={14} />
              Select location
            </label>

            <select
              value={selectedLocation}
              onChange={(event) =>
                setSelectedLocation(event.target.value)
              }
              className="w-full border border-[#55401F] bg-[#17130D] p-3 text-sm text-[#F1E8D8] outline-none focus:border-[#E6C98E]"
            >
              <option value="ALL">All locations</option>

              {locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>
        </section>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-[#C49A55]">
            <RefreshCw className="animate-spin" />
            Loading forecasting intelligence...
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Historical records",
                  value: formatNumber(filteredHistory.length),
                  detail: "Actual consumption records",
                  icon: Database,
                },
                {
                  label: "Forecast records",
                  value: formatNumber(filteredForecasts.length),
                  detail: "Matching predictions",
                  icon: CalendarDays,
                },
                {
                  label: "Total forecast quantity",
                  value: formatNumber(totalForecast),
                  detail: "Selected forecast scope",
                  icon: TrendingUp,
                },
                {
                  label: "Selected model",
                  value: selectedModel.toUpperCase(),
                  detail: `Demand pattern: ${classification}`,
                  icon: BrainCircuit,
                },
              ].map((metric) => {
                const Icon = metric.icon;

                return (
                  <div
                    key={metric.label}
                    className="border border-[#332A1B] bg-[#101010] p-5"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A69A85]">
                        {metric.label}
                      </p>

                      <Icon size={19} className="text-[#C49A55]" />
                    </div>

                    <p className="mt-6 break-words text-3xl font-semibold text-[#F1E8D8]">
                      {metric.value}
                    </p>

                    <p className="mt-2 text-xs text-[#8F826D]">
                      {metric.detail}
                    </p>
                  </div>
                );
              })}
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="border border-[#332A1B] bg-[#101010] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A69A85]">
                  Historical consumption
                </p>

                <p className="mt-4 text-2xl font-semibold text-[#F1E8D8]">
                  {formatNumber(totalHistorical)}
                </p>

                <p className="mt-2 text-xs text-[#8F826D]">
                  Total recorded quantity in the selected scope
                </p>
              </div>

              <div className="border border-[#332A1B] bg-[#101010] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A69A85]">
                  Average prediction
                </p>

                <p className="mt-4 text-2xl font-semibold text-[#F1E8D8]">
                  {formatNumber(averageForecast)}
                </p>

                <p className="mt-2 text-xs text-[#8F826D]">
                  Average quantity per forecast record
                </p>
              </div>
            </section>

            <section className="border border-[#332A1B] bg-[#101010] p-6 md:p-8">
              <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#C49A55]">
                    Forecast visualization
                  </p>

                  <h3 className="mt-2 text-xl font-semibold">
                    Actual vs predicted demand
                  </h3>

                  <p className="mt-2 text-xs text-[#8F826D]">
                    {selectedItem === "ALL"
                      ? "All materials"
                      : selectedItem}
                    {" · "}
                    {selectedLocation === "ALL"
                      ? "All locations"
                      : selectedLocation}
                  </p>
                </div>

                <span className="border border-[#55401F] px-3 py-2 text-xs text-[#E6C98E]">
                  156-WEEK HISTORY + 12-WEEK FORECAST
                </span>
              </div>

              {chartData.length > 0 ? (
                <div className="h-[380px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{
                        top: 10,
                        right: 15,
                        left: 5,
                        bottom: 5,
                      }}
                    >
                      <defs>
                        <linearGradient
                          id="actualGold"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#C49A55"
                            stopOpacity={0.25}
                          />
                          <stop
                            offset="95%"
                            stopColor="#C49A55"
                            stopOpacity={0}
                          />
                        </linearGradient>

                        <linearGradient
  id="forecastGold"
  x1="0"
  y1="0"
  x2="0"
  y2="1"
>
  <stop
    offset="0%"
    stopColor="#E6C98E"
    stopOpacity={0.35}
  />
  <stop
    offset="95%"
    stopColor="#E6C98E"
    stopOpacity={0}
  />
</linearGradient>
  
                      </defs>

                      <CartesianGrid
                        stroke="#29251E"
                        strokeDasharray="3 3"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="week"
                        stroke="#81745F"
                        tick={{ fill: "#A69A85", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={35}
                      />

                      <YAxis
                        stroke="#81745F"
                        tick={{ fill: "#A69A85", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={65}
                      />

                      <Tooltip
                        contentStyle={{
                          background: "#17130D",
                          border: "1px solid #55401F",
                          borderRadius: 0,
                          color: "#F1E8D8",
                        }}
                        formatter={(value, name) => [
                          formatNumber(Number(value)),
                          name === "actual"
                            ? "Historical consumption"
                            : "Predicted demand",
                        ]}
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.fullDate ?? ""
                        }
                      />

                      {forecastStart && (
                        <ReferenceLine
                          x={formatWeek(forecastStart)}
                          stroke="#E6C98E"
                          strokeDasharray="5 5"
                          strokeWidth={1.5}
                          label={{
                            value: "Forecast begins",
                            position: "insideTopRight",
                            fill: "#E6C98E",
                            fontSize: 11,
                          }}
                        />
                      )}

                      <Area
                        type="monotone"
                        dataKey="actual"
                        name="actual"
                        stroke="#C49A55"
                        strokeWidth={2}
                        fill="url(#actualGold)"
                        connectNulls={false}
                        activeDot={{
                          r: 4,
                          fill: "#C49A55",
                          stroke: "#000",
                        }}
                      />

                      <Area
                        type="monotone"
                        dataKey="predicted"
                        name="predicted"
                        stroke="#E6C98E"
                        strokeWidth={2.5}
                        fill="url(#forecastGold)"
                        connectNulls={false}
                        activeDot={{
                          r: 5,
                          fill: "#E6C98E",
                          stroke: "#000",
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-[#8F826D]">
                  No historical or forecast records match these filters.
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-6 border-t border-[#29251E] pt-5">
                <div className="flex items-center gap-2 text-xs text-[#A69A85]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#C49A55]" />
                  Historical consumption
                </div>

                <div className="flex items-center gap-2 text-xs text-[#A69A85]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#E6C98E]" />
                  Predicted demand
                </div>
              </div>

              <p className="mt-4 text-xs leading-6 text-[#8F826D]">
                Historical values represent recorded consumption from the active
                dataset. Predicted values represent the forecasting model's output.
                When multiple materials are selected, quantities are summed
                across materials and may use different measurement units.
                Interpret that combined chart as a numerical overview only.
              </p>
            </section>

            <section className="border border-[#332A1B] bg-[#101010]">
              <div className="border-b border-[#332A1B] p-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#C49A55]">
                  Prediction details
                </p>

                <h3 className="mt-2 text-xl font-semibold">
                  Weekly forecast records
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#17130D] text-[10px] uppercase tracking-widest text-[#A69A85]">
                    <tr>
                      <th className="px-6 py-4">Forecast week</th>
                      <th className="px-6 py-4">Material</th>
                      <th className="px-6 py-4">Location</th>
                      <th className="px-6 py-4">Predicted quantity</th>
                      <th className="px-6 py-4">Model</th>
                      <th className="px-6 py-4">Classification</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredForecasts.map((row, index) => (
                      <tr
                        key={`${row.item_code}-${row.location_code}-${row.week_start}-${index}`}
                        className="border-t border-[#29251E] hover:bg-[#17130D]"
                      >
                        <td className="whitespace-nowrap px-6 py-4 text-[#D5C5A8]">
                          {formatWeek(row.week_start)}
                        </td>

                        <td className="whitespace-nowrap px-6 py-4">
                          {row.item_code}
                        </td>

                        <td className="whitespace-nowrap px-6 py-4 text-[#A69A85]">
                          {row.location_code}
                        </td>

                        <td className="whitespace-nowrap px-6 py-4 font-semibold text-[#E6C98E]">
                          {formatNumber(row.forecast_quantity)}
                        </td>

                        <td className="whitespace-nowrap px-6 py-4 uppercase text-[#D5C5A8]">
                          {row.selected_model}
                        </td>

                        <td className="whitespace-nowrap px-6 py-4 capitalize text-[#A69A85]">
                          {row.classification}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredForecasts.length === 0 && (
                <p className="p-8 text-center text-sm text-[#8F826D]">
                  No forecast records available for this selection.
                </p>
              )}
            </section>
          </>
        )}

        <footer className="border-t border-[#332A1B] py-5 text-xs text-[#756A58]">
          Janus AI · DEMAND FORECASTING ENGINE · ACTIVE DATASET
        </footer>
      </main>
    </div>
  );
}