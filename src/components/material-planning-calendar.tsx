"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  Filter,
  LoaderCircle,
  Package,
  RefreshCw,
  Truck,
  X,
} from "lucide-react";

const API_BASE = "https://janus-ai-backend-j6bb.onrender.com";

type WorkspacePermission = {
  allowed: boolean;
  status?: string;
  reason?: string | null;
};

type AccessResponse = {
  success: boolean;
  dataset_mode: "SYNTHETIC" | "UPLOADED";
  dataset: {
    id?: string;
    name?: string;
    type?: string;
  } | null;
  workspaces: {
    forecasting?: WorkspacePermission;
    inventory?: WorkspacePermission;
  };
};

type ForecastRecord = {
  week_start?: string;
  item_code?: string;
  location_code?: string;
  forecast_quantity?: number;
  selected_model?: string;
  classification?: string;
  source?: string;
};

type PurchaseOrder = {
  po_id?: string;
  order_date?: string;
  expected_arrival_date?: string;
  receipt_date?: string | null;
  item_code?: string;
  location_code?: string;
  supplier_code?: string;
  ordered_quantity?: number;
  status?: string;
  is_delayed?: boolean;
  is_emergency?: boolean;
  total_cost?: number;
};

type ApiResponse<T> = {
  total_records: number;
  returned_records: number;
  data?: T[];
  records?: T[];
  dataset?: {
    dataset_id?: string;
    dataset_name?: string;
    dataset_type?: string;
  };
};

type EventType =
  | "forecast"
  | "order"
  | "delivery"
  | "receipt";

type CalendarEvent = {
  id: string;
  date: string;
  type: EventType;
  title: string;
  material: string;
  location: string;
  quantity?: number;
  unit?: string;
  poId?: string;
  supplier?: string;
  status?: string;
  model?: string;
  classification?: string;
  delayed?: boolean;
  emergency?: boolean;
};

type ViewMode = "month" | "week" | "agenda";

const EVENT_STYLES: Record<
  EventType,
  { label: string; color: string; background: string }
> = {
  forecast: {
    label: "Demand forecast",
    color: "text-blue-300",
    background: "bg-blue-500/15 border-blue-400/20",
  },
  order: {
    label: "Purchase order",
    color: "text-[#E6C98E]",
    background: "bg-[#C9A362]/15 border-[#C9A362]/25",
  },
  delivery: {
    label: "Expected delivery",
    color: "text-emerald-300",
    background: "bg-emerald-500/15 border-emerald-400/20",
  },
  receipt: {
    label: "Actual receipt",
    color: "text-purple-300",
    background: "bg-purple-500/15 border-purple-400/20",
  },
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseDate(value?: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatDate(value: string): string {
  const date = parseDate(value);
  if (!date) return value;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function createEvents(
  forecasts: ForecastRecord[],
  purchaseOrders: PurchaseOrder[]
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  forecasts.forEach((record, index) => {
    const date = parseDate(record.week_start);
    if (!date) return;

    events.push({
      id: `forecast-${index}-${record.item_code}-${record.location_code}`,
      date: dateKey(date),
      type: "forecast",
      title: "Weekly demand forecast",
      material: record.item_code || "Unknown material",
      location: record.location_code || "Unknown location",
      quantity: Number(record.forecast_quantity),
      unit: "units",
      model: record.selected_model,
      classification: record.classification,
      status: "Forecast",
    });
  });

  purchaseOrders.forEach((po, index) => {
    const common = {
      material: po.item_code || "Unknown material",
      location: po.location_code || "Unknown location",
      quantity: Number(po.ordered_quantity),
      unit: "units",
      poId: po.po_id,
      supplier: po.supplier_code,
      status: po.status,
      delayed: po.is_delayed === true,
      emergency: po.is_emergency === true,
    };

    const orderDate = parseDate(po.order_date);
    if (orderDate) {
      events.push({
        ...common,
        id: `order-${index}`,
        date: dateKey(orderDate),
        type: "order",
        title: "Purchase order placed",
      });
    }

    const expectedDate = parseDate(po.expected_arrival_date);
    if (expectedDate) {
      events.push({
        ...common,
        id: `delivery-${index}`,
        date: dateKey(expectedDate),
        type: "delivery",
        title: "Expected material delivery",
      });
    }

    const receiptDate = parseDate(po.receipt_date);
    if (receiptDate) {
      events.push({
        ...common,
        id: `receipt-${index}`,
        date: dateKey(receiptDate),
        type: "receipt",
        title: "Material received",
      });
    }
  });

  return events;
}

export default function MaterialPlanningCalendar() {
  const [access, setAccess] = useState<AccessResponse | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forecastError, setForecastError] = useState("");
  const [inventoryError, setInventoryError] = useState("");
  const [forecastTruncated, setForecastTruncated] = useState(false);
  const [inventoryTruncated, setInventoryTruncated] = useState(false);

  const [currentDate, setCurrentDate] = useState(
  () => new Date(2000, 0, 1)
);
  const [view, setView] = useState<ViewMode>("month");
  const [selectedEvent, setSelectedEvent] =
    useState<CalendarEvent | null>(null);

  const [materialFilter, setMaterialFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setError("");
    setForecastError("");
    setInventoryError("");
    setSelectedEvent(null);

    try {
      const accessResponse = await fetch(
        `${API_BASE}/api/data-intelligence/workspace-access`,
        { cache: "no-store" }
      );

      if (!accessResponse.ok) {
        throw new Error("Unable to verify dataset workspace permissions.");
      }

      const accessData: AccessResponse = await accessResponse.json();

      if (!accessData.success) {
        throw new Error("Dataset access information is unavailable.");
      }

      setAccess(accessData);

      const canForecast =
        accessData.dataset_mode === "SYNTHETIC" ||
        accessData.workspaces?.forecasting?.allowed === true;

      const canInventory =
        accessData.dataset_mode === "SYNTHETIC" ||
        accessData.workspaces?.inventory?.allowed === true;

      const [forecastResult, inventoryResult] = await Promise.allSettled([
        canForecast
          ? fetch(`${API_BASE}/api/forecasts?limit=5000`, {
              cache: "no-store",
            }).then(async (response) => {
              if (!response.ok) {
                throw new Error(`Forecast API returned ${response.status}`);
              }
              return (await response.json()) as ApiResponse<ForecastRecord>;
            })
          : Promise.resolve(null),

        canInventory
          ? fetch(`${API_BASE}/api/inventory/purchase-orders?limit=5000`, {
              cache: "no-store",
            }).then(async (response) => {
              if (!response.ok) {
                throw new Error(`Inventory API returned ${response.status}`);
              }
              return (await response.json()) as ApiResponse<PurchaseOrder>;
            })
          : Promise.resolve(null),
      ]);

      let forecastRecords: ForecastRecord[] = [];
      let purchaseOrders: PurchaseOrder[] = [];

      if (!canForecast) {
        setForecastError(
          accessData.workspaces?.forecasting?.reason ||
            "Forecasting workspace is not approved for this dataset."
        );
      } else if (forecastResult.status === "fulfilled") {
        forecastRecords = forecastResult.value?.data || [];
        const total = forecastResult.value?.total_records ?? 0;
        const returned = forecastResult.value?.returned_records ?? 0;
        setForecastTruncated(returned < total);
      } else {
        setForecastError(
          forecastResult.reason instanceof Error
            ? forecastResult.reason.message
            : "Unable to load forecasts."
        );
      }

      if (!canInventory) {
        setInventoryError(
          accessData.workspaces?.inventory?.reason ||
            "Inventory workspace is not approved for this dataset."
        );
      } else if (inventoryResult.status === "fulfilled") {
        purchaseOrders = inventoryResult.value?.records || [];
        const total = inventoryResult.value?.total_records ?? 0;
        const returned = inventoryResult.value?.returned_records ?? 0;
        setInventoryTruncated(returned < total);
      } else {
        setInventoryError(
          inventoryResult.reason instanceof Error
            ? inventoryResult.reason.message
            : "Unable to load purchase orders."
        );
      }

      setEvents(createEvents(forecastRecords, purchaseOrders));
    } catch (err) {
      setAccess(null);
      setEvents([]);
      setError(
        err instanceof Error ? err.message : "Calendar data is unavailable."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
  let cancelled = false;

  const startLoading = () => {
    if (!cancelled) {
      void loadCalendar();
    }
  };

  queueMicrotask(startLoading);

  return () => {
    cancelled = true;
  };
}, [loadCalendar]);

useEffect(() => {
  let cancelled = false;

  queueMicrotask(() => {
    if (!cancelled) {
      setCurrentDate(new Date());
    }
  });

  return () => {
    cancelled = true;
  };
}, []);

  const materials = useMemo(
    () =>
      [...new Set(events.map((event) => event.material))]
        .filter(Boolean)
        .sort(),
    [events]
  );

  const locations = useMemo(
    () =>
      [...new Set(events.map((event) => event.location))]
        .filter(Boolean)
        .sort(),
    [events]
  );

  const filteredEvents = useMemo(
    () =>
      events
        .filter(
          (event) =>
            materialFilter === "all" ||
            event.material === materialFilter
        )
        .filter(
          (event) =>
            locationFilter === "all" ||
            event.location === locationFilter
        )
        .filter(
          (event) => typeFilter === "all" || event.type === typeFilter
        )
        .sort((a, b) => a.date.localeCompare(b.date)),
    [events, materialFilter, locationFilter, typeFilter]
  );

  const eventsByDate = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};

    filteredEvents.forEach((event) => {
      if (!grouped[event.date]) grouped[event.date] = [];
      grouped[event.date].push(event);
    });

    return grouped;
  }, [filteredEvents]);

  const monthTitle = currentDate.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const monthDays = useMemo(() => {
    const first = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const gridStart = startOfWeek(first);

    return Array.from({ length: 42 }, (_, index) =>
      addDays(gridStart, index)
    );
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const first = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, index) =>
      addDays(first, index)
    );
  }, [currentDate]);

  const visibleDates =
    view === "month" ? monthDays : view === "week" ? weekDays : [];

  function navigate(amount: number) {
    setSelectedEvent(null);

    setCurrentDate((previous) => {
      const next = new Date(previous);

      if (view === "month") {
        next.setMonth(next.getMonth() + amount);
      } else if (view === "week") {
        next.setDate(next.getDate() + amount * 7);
      } else {
        next.setDate(next.getDate() + amount * 30);
      }

      return next;
    });
  }

  function renderEvent(event: CalendarEvent, compact = false) {
    const style = EVENT_STYLES[event.type];

    return (
      <button
        key={event.id}
        type="button"
        onClick={() => setSelectedEvent(event)}
        className={`w-full truncate rounded border px-1.5 py-1 text-left text-[9px] transition hover:brightness-125 ${style.background} ${style.color}`}
        title={`${event.title}: ${event.material}`}
      >
        {compact
          ? `${event.type === "forecast" ? "FC" : event.type === "order" ? "PO" : event.type === "delivery" ? "DEL" : "REC"} · ${event.material}`
          : `${event.title} · ${event.material}`}
      </button>
    );
  }

  const sourceName =
    access?.dataset?.name ||
    (access?.dataset_mode === "SYNTHETIC"
      ? "Synthetic Demo"
      : "Uploaded dataset");

  return (
    <main className="min-h-screen bg-[#080807] text-[#F1E8D8]">
      <header className="sticky top-0 z-20 flex min-h-[76px] items-center justify-between gap-4 border-b border-[#C9A362]/15 bg-[#080807]/95 px-5 backdrop-blur-xl sm:px-9">
        <div>
          <p className="text-[9px] font-bold tracking-[2px] text-[#A88B58]">
            JANUS AI / PLANNING
          </p>
          <h1 className="mt-1 text-[17px] font-semibold text-[#F0E5D1]">
            Material Planning Calendar
          </h1>
        </div>

        <button
          type="button"
          onClick={loadCalendar}
          disabled={loading}
          className="flex items-center gap-2 border border-[#C9A362]/30 px-3 py-2 text-[10px] text-[#E6C98E] transition hover:bg-[#C9A362]/10 disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-8 sm:py-9">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[9px] font-bold tracking-[2.5px] text-[#C5A56D]">
              <span className="h-px w-7 bg-[#C5A56D]" />
              PROCUREMENT & DEMAND OVERVIEW
            </div>
            <h2 className="font-[var(--font-cormorant)] text-[38px] leading-none text-[#F2E8D8] sm:text-[48px]">
              Plan ahead. Stay prepared.
            </h2>
            <p className="mt-3 max-w-2xl text-[11px] leading-6 text-[#9D9588]">
              Track weekly material demand, purchase orders, expected
              deliveries and confirmed receipts in one place.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded border border-[#C9A362]/20 bg-[#0D0D0B] px-3 py-2.5">
            <Database size={14} className="text-[#C9A362]" />
            <div>
              <p className="text-[8px] uppercase tracking-wider text-[#847B6D]">
                Active data source
              </p>
              <p className="mt-0.5 text-[10px] font-semibold text-[#E9D8B9]">
                {loading ? "Checking..." : sourceName || "Unavailable"}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded border border-red-500/20 bg-red-500/[0.06] p-4 text-xs text-red-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Calendar data unavailable</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}

        {(forecastError || inventoryError) && !error && (
          <div className="mb-5 grid gap-3 md:grid-cols-2">
            {forecastError && (
              <div className="flex items-start gap-2 rounded border border-amber-500/20 bg-amber-500/[0.05] p-3 text-[10px] text-amber-200">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Forecasting events unavailable</p>
                  <p className="mt-1 text-amber-200/70">{forecastError}</p>
                </div>
              </div>
            )}
            {inventoryError && (
              <div className="flex items-start gap-2 rounded border border-amber-500/20 bg-amber-500/[0.05] p-3 text-[10px] text-amber-200">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Inventory events unavailable</p>
                  <p className="mt-1 text-amber-200/70">{inventoryError}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {(forecastTruncated || inventoryTruncated) && (
          <div className="mb-5 flex items-start gap-2 rounded border border-amber-500/20 bg-amber-500/[0.05] p-3 text-[10px] text-amber-200">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            Some records are not displayed because the API result limit was
            reached. The calendar may not show every event.
          </div>
        )}

        <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(
            [
              ["Total events", filteredEvents.length, CalendarDays],
              [
                "Weekly forecasts",
                filteredEvents.filter((event) => event.type === "forecast")
                  .length,
                Package,
              ],
              [
                "Expected deliveries",
                filteredEvents.filter((event) => event.type === "delivery")
                  .length,
                Truck,
              ],
              [
                "Purchase orders",
                filteredEvents.filter((event) => event.type === "order")
                  .length,
                Clock3,
              ],
            ] as const
          ).map(([label, value, Icon]) => (
            <div
              key={label}
              className="rounded border border-[#C9A362]/15 bg-[#0D0D0B] p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-[9px] uppercase tracking-wider text-[#8F826D]">
                  {label}
                </p>
                <Icon size={15} className="text-[#C9A362]" />
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-[#E9D8B9]">
                {loading ? "—" : value.toLocaleString("en-IN")}
              </p>
            </div>
          ))}
        </section>

        <section className="mb-5 rounded border border-[#C9A362]/15 bg-[#0D0D0B] p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold text-[#D8C39D]">
            <Filter size={14} />
            FILTER CALENDAR EVENTS
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <select
              value={materialFilter}
              onChange={(event) => setMaterialFilter(event.target.value)}
              className="min-w-0 rounded border border-white/10 bg-[#151515] px-3 py-2.5 text-[10px] text-[#D8CBB5] outline-none focus:border-[#C9A362]/50"
            >
              <option value="all">All materials</option>
              {materials.map((material) => (
                <option key={material} value={material}>
                  {material}
                </option>
              ))}
            </select>

            <select
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
              className="min-w-0 rounded border border-white/10 bg-[#151515] px-3 py-2.5 text-[10px] text-[#D8CBB5] outline-none focus:border-[#C9A362]/50"
            >
              <option value="all">All locations</option>
              {locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="min-w-0 rounded border border-white/10 bg-[#151515] px-3 py-2.5 text-[10px] text-[#D8CBB5] outline-none focus:border-[#C9A362]/50"
            >
              <option value="all">All event types</option>
              {Object.entries(EVENT_STYLES).map(([key, style]) => (
                <option key={key} value={key}>
                  {style.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-[#C9A362]/15 bg-[#0D0D0B]">
          <div className="flex flex-col justify-between gap-4 border-b border-white/[0.07] p-4 sm:flex-row sm:items-center sm:px-5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                aria-label="Previous period"
                className="rounded border border-white/10 p-2 text-[#D8C39D] hover:bg-white/5"
              >
                <ArrowLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => setCurrentDate(new Date())}
                className="border border-[#C9A362]/25 px-3 py-2 text-[9px] text-[#E6C98E] hover:bg-[#C9A362]/10"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => navigate(1)}
                aria-label="Next period"
                className="rounded border border-white/10 p-2 text-[#D8C39D] hover:bg-white/5"
              >
                <ArrowRight size={14} />
              </button>
              <h3 className="ml-1 text-[15px] font-semibold text-[#E9D8B9]">
                {view === "agenda"
                  ? "Event agenda"
                  : view === "week"
                    ? `${formatDate(dateKey(weekDays[0]))} – ${formatDate(
                        dateKey(weekDays[6])
                      )}`
                    : monthTitle}
              </h3>
            </div>

            <div className="flex rounded border border-white/10 p-1">
              {(["month", "week", "agenda"] as ViewMode[]).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => setView(mode)}
                  className={`px-3 py-2 text-[9px] capitalize transition ${
                    view === mode
                      ? "bg-[#C9A362]/20 text-[#E6C98E]"
                      : "text-[#8F826D] hover:text-[#D8C39D]"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center gap-3 text-xs text-[#A69A85]">
              <LoaderCircle size={18} className="animate-spin text-[#C9A362]" />
              Loading planning events...
            </div>
          ) : error ? (
            <div className="p-10 text-center text-xs text-[#9D9588]">
              Calendar could not be loaded. Use Refresh to try again.
            </div>
          ) : view === "agenda" ? (
            <div className="divide-y divide-white/[0.06]">
              {filteredEvents.length === 0 ? (
                <p className="p-10 text-center text-xs text-[#8F826D]">
                  No events match the selected filters.
                </p>
              ) : (
                filteredEvents.map((event) => (
                  <div
                    key={event.id}
                    className="grid gap-3 px-5 py-4 sm:grid-cols-[125px_1fr]"
                  >
                    <p className="text-[10px] text-[#C9A362]">
                      {formatDate(event.date)}
                    </p>
                    <div>{renderEvent(event)}</div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                <div className="grid grid-cols-7 border-b border-white/[0.07]">
                  {DAY_NAMES.map((day) => (
                    <div
                      key={day}
                      className="py-3 text-center text-[9px] font-semibold uppercase tracking-wider text-[#8F826D]"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {visibleDates.map((date) => {
                    const key = dateKey(date);
                    const dayEvents = eventsByDate[key] || [];
                    const isCurrentMonth =
                      date.getMonth() === currentDate.getMonth();
                   const isToday = key === dateKey(currentDate);

                    return (
                      <div
                        key={key}
                        className={`min-h-[125px] border-b border-r border-white/[0.06] p-2 ${
                          view === "week" ? "min-h-[230px]" : ""
                        } ${
                          view === "month" && !isCurrentMonth
                            ? "bg-black/20"
                            : ""
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${
                              isToday
                                ? "bg-[#C9A362] font-bold text-black"
                                : isCurrentMonth || view === "week"
                                  ? "text-[#D8CBB5]"
                                  : "text-[#555047]"
                            }`}
                          >
                            {date.getDate()}
                          </span>
                          {dayEvents.length > 0 && (
                            <span className="text-[8px] text-[#8F826D]">
                              {dayEvents.length} events
                            </span>
                          )}
                        </div>

                        <div className="space-y-1">
                          {dayEvents
                            .slice(0, view === "week" ? 12 : 3)
                            .map((event) =>
                              renderEvent(event, view === "month")
                            )}
                          {dayEvents.length >
                            (view === "week" ? 12 : 3) && (
                            <p className="px-1 text-[8px] text-[#9D9588]">
                              +{dayEvents.length - (view === "week" ? 12 : 3)}{" "}
                              more
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 rounded border border-white/[0.06] bg-[#0D0D0B] px-4 py-3">
          {Object.entries(EVENT_STYLES).map(([key, style]) => (
            <div key={key} className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${style.background.split(" ")[0]}`}
              />
              <span className="text-[9px] text-[#A69A85]">
                {style.label}
              </span>
            </div>
          ))}
        </div>

        {selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded border border-[#C9A362]/25 bg-[#11110F] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/[0.08] p-5">
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-[#A88B58]">
                    Planning event
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-[#E9D8B9]">
                    {selectedEvent.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  aria-label="Close event details"
                  className="rounded p-2 text-[#A69A85] hover:bg-white/5"
                >
                  <X size={17} />
                </button>
              </div>

              <div className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`rounded border px-2.5 py-1 text-[9px] ${EVENT_STYLES[selectedEvent.type].background} ${EVENT_STYLES[selectedEvent.type].color}`}
                  >
                    {EVENT_STYLES[selectedEvent.type].label}
                  </span>
                  <span className="text-[10px] text-[#C9A362]">
                    {formatDate(selectedEvent.date)}
                    {selectedEvent.type === "forecast" && " · Week starting"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Material", selectedEvent.material],
                    ["Location", selectedEvent.location],
                    [
                      "Quantity",
                      selectedEvent.quantity !== undefined &&
                      Number.isFinite(selectedEvent.quantity)
                        ? `${selectedEvent.quantity.toLocaleString("en-IN")} ${selectedEvent.unit || ""}`
                        : "Not available",
                    ],
                    ["Status", selectedEvent.status || "Not specified"],
                    ...(selectedEvent.poId
                      ? [["PO ID", selectedEvent.poId]]
                      : []),
                    ...(selectedEvent.supplier
                      ? [["Supplier", selectedEvent.supplier]]
                      : []),
                    ...(selectedEvent.model
                      ? [["Forecast model", selectedEvent.model]]
                      : []),
                    ...(selectedEvent.classification
                      ? [["Demand classification", selectedEvent.classification]]
                      : []),
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded border border-white/[0.07] bg-white/[0.02] p-3"
                    >
                      <p className="text-[8px] uppercase tracking-wider text-[#81745F]">
                        {label}
                      </p>
                      <p className="mt-1 break-words text-[11px] text-[#E3D5BE]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                {(selectedEvent.delayed || selectedEvent.emergency) && (
                  <div className="flex flex-wrap gap-2">
                    {selectedEvent.delayed && (
                      <span className="rounded bg-red-500/10 px-2 py-1 text-[9px] text-red-300">
                        Delayed order
                      </span>
                    )}
                    {selectedEvent.emergency && (
                      <span className="rounded bg-amber-500/10 px-2 py-1 text-[9px] text-amber-200">
                        Emergency order
                      </span>
                    )}
                  </div>
                )}

                {selectedEvent.type === "forecast" && (
                  <p className="text-[9px] leading-5 text-[#8F826D]">
                    This is a weekly forecast quantity, not a daily demand
                    figure.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-start gap-2 text-[9px] leading-5 text-[#777166]">
          <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[#A88B58]" />
          Read-only planning view. Calendar events are derived from the active
          dataset and do not create or modify purchase orders, inventory or
          forecasts.
        </div>
      </div>
    </main>
  );
}
