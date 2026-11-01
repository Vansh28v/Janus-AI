"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock3,
  Database,
  File,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Layers3,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  Zap,
} from "lucide-react";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api") +
  "/data-intelligence";

const TABLE_OPTIONS = [
  "materials",
  "locations",
  "suppliers",
  "consumption",
  "opening_balances",
  "stock_movements",
  "purchase_orders",
  "weekly_inventory",
];

type Dataset = {
  id: string;
  name: string;
  type: string;
  description?: string;
  status?: string;
  created_at?: string;
  files?: string[];
  profile?: any;
  [key: string]: any;
};

type MappingDraft = {
  file: string;
  sheet: string;
  table_name: string;
  mapping: Record<string, string>;
  suggestions?: Record<string, string>;
};

type Notice = {
  type: "success" | "error" | "info";
  message: string;
};

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function pretty(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusTone(status?: string) {
  const value = (status || "").toLowerCase();
  if (
    ["ready", "completed", "approved", "active", "success"].includes(value)
  ) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
  if (
    ["failed", "validation_failed", "error", "rejected"].includes(value)
  ) {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }
  if (
    ["review", "processing", "pending", "awaiting_approval"].includes(value)
  ) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  }
  return "border-white/10 bg-white/[0.04] text-[#B8B1A5]";
}

function getErrorMessage(error: any): string {
  const detail = error?.detail;
  if (typeof detail === "string") return detail;
  if (detail?.message) return detail.message;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || JSON.stringify(item)).join(", ");
  }
  if (detail) return JSON.stringify(detail);
  return error?.message || "Something went wrong. Please try again.";
}

async function apiRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getErrorMessage(data));
  }

  return data;
}

function collectMappingCandidates(
  value: any,
  output: MappingDraft[] = [],
  seen = new Set<string>()
): MappingDraft[] {
  if (!value || typeof value !== "object") return output;

  if (Array.isArray(value)) {
    value.forEach((item) => collectMappingCandidates(item, output, seen));
    return output;
  }

  const file = value.file || value.filename || value.source_file;
  const sheet = value.sheet || value.sheet_name || "Sheet1";
  const table =
    value.table_name ||
    value.canonical_table ||
    value.suggested_table ||
    value.identified_table;

  const suggested =
    value.suggested_mapping ||
    value.mapping ||
    value.column_mapping ||
    value.field_mapping;

  if (
    typeof file === "string" &&
    typeof table === "string" &&
    suggested &&
    typeof suggested === "object" &&
    !Array.isArray(suggested)
  ) {
    const key = `${file}|${sheet}|${table}`;
    if (!seen.has(key)) {
      seen.add(key);
      output.push({
        file,
        sheet,
        table_name: table,
        mapping: { ...suggested },
        suggestions: { ...suggested },
      });
    }
  }

  Object.values(value).forEach((child) => {
    if (child && typeof child === "object") {
      collectMappingCandidates(child, output, seen);
    }
  });

  return output;
}

function SectionHeading({
  eyebrow,
  title,
  description,
  right,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#C9A362]">
          {eyebrow}
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-[#F1E8D8] sm:text-2xl">
          {title}
        </h2>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#898477]">
            {description}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: any;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#0D0D0B] p-4">
      <div className="flex items-start justify-between">
        <div className="text-[10px] font-medium uppercase tracking-[0.17em] text-[#898477]">
          {label}
        </div>
        <Icon size={17} className="text-[#C9A362]" />
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-[#F1E8D8]">
        {value}
      </div>
      <div className="mt-1 text-xs text-[#777166]">{detail}</div>
    </div>
  );
}

function StepIndicator({
  number,
  label,
  active,
  complete,
}: {
  number: number;
  label: string;
  active: boolean;
  complete: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
          complete
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
            : active
              ? "border-[#C9A362]/60 bg-[#C9A362]/10 text-[#E6C98E]"
              : "border-white/10 bg-white/[0.03] text-[#777166]"
        )}
      >
        {complete ? <Check size={13} /> : number}
      </div>
      <span
        className={cn(
          "truncate text-[11px] font-medium",
          active || complete ? "text-[#E6D7BC]" : "text-[#777166]"
        )}
      >
        {label}
      </span>
    </div>
  );
}

export default function DataIntelligencePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState("");
  const [selectedDatasetId, setSelectedDatasetId] = useState("");

  const [datasetDetail, setDatasetDetail] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [validationReport, setValidationReport] = useState<any>(null);
  const [normalizationReport, setNormalizationReport] = useState<any>(null);
  const [qualityReport, setQualityReport] = useState<any>(null);

  const [mappingDrafts, setMappingDrafts] = useState<MappingDraft[]>([]);
  const [selectedMapping, setSelectedMapping] = useState(0);

  const [uploadName, setUploadName] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);

  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showMappings, setShowMappings] = useState(false);

  const selectedDataset = useMemo(
    () => datasets.find((item) => item.id === selectedDatasetId),
    [datasets, selectedDatasetId]
  );

  const uploadedDatasets = useMemo(
    () => datasets.filter((item) => item.type === "uploaded"),
    [datasets]
  );

  const syntheticDataset = useMemo(
    () => datasets.find((item) => item.type === "synthetic"),
    [datasets]
  );

  const readyWorkspaceCount = useMemo(() => {
  const compatibility = qualityReport?.workspace_compatibility || {};

  return Object.values(compatibility).filter(
    (item: any) => item?.compatible === true
  ).length;
}, [qualityReport]);

  const notify = useCallback(
    (type: Notice["type"], message: string) => {
      setNotice({ type, message });
      window.setTimeout(() => setNotice(null), 5000);
    },
    []
  );

  const loadDatasets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest("/datasets");
      const list = data.datasets || [];
      setDatasets(list);
      setActiveDatasetId(data.active_dataset_id || "");

      if (!selectedDatasetId && list.length) {
        setSelectedDatasetId(data.active_dataset_id || list[0].id);
      } else if (
        selectedDatasetId &&
        !list.some((item: Dataset) => item.id === selectedDatasetId)
      ) {
        setSelectedDatasetId(data.active_dataset_id || list[0]?.id || "");
      }
    } catch (error: any) {
      notify("error", error.message);
    } finally {
      setLoading(false);
    }
  }, [notify, selectedDatasetId]);

  const loadDatasetDetail = useCallback(
    async (datasetId: string) => {
      if (!datasetId) return;

      try {
        const [detailResult, activeResult] = await Promise.all([
          apiRequest(`/datasets/${datasetId}`),
          apiRequest("/active"),
        ]);

        setDatasetDetail(detailResult);
        setActiveDatasetId(activeResult.dataset_id || "");

        const dataset = detailResult.dataset || {};

        setAnalysis(dataset.schema_analysis || null);
        setValidationReport(dataset.validation_report || null);
        setNormalizationReport(dataset.normalization_report || null);
        setQualityReport(dataset.quality_report || null);

        const savedMappings = dataset.confirmed_mappings || [];

        if (savedMappings.length) {
          setMappingDrafts(
            savedMappings.map((item: any) => ({
              file: item.file,
              sheet: item.sheet,
              table_name: item.table_name,
              mapping: { ...item.mapping },
              suggestions: { ...item.mapping },
            }))
          );
        } else {
          setMappingDrafts([]);
        }
      } catch (error: any) {
        setDatasetDetail(null);
        notify("error", error.message);
      }
    },
    [notify]
  );

  useEffect(() => {
    loadDatasets();
  }, [loadDatasets]);

  useEffect(() => {
    if (selectedDatasetId) {
      loadDatasetDetail(selectedDatasetId);
    } else {
      setDatasetDetail(null);
      setAnalysis(null);
      setValidationReport(null);
      setNormalizationReport(null);
      setQualityReport(null);
      setMappingDrafts([]);
    }
  }, [selectedDatasetId, loadDatasetDetail]);

  const runAction = async (
    key: string,
    action: () => Promise<any>,
    successMessage: string,
    refresh = true
  ) => {
    setBusyAction(key);
    try {
      const result = await action();
      notify("success", successMessage);
      if (refresh) {
        await loadDatasets();
        if (selectedDatasetId) {
          await loadDatasetDetail(selectedDatasetId);
        }
      }
      return result;
    } catch (error: any) {
      notify("error", error.message);
      return null;
    } finally {
      setBusyAction("");
    }
  };

  const addFiles = (incoming: FileList | File[]) => {
    const files = Array.from(incoming);
    const valid = files.filter((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase();
      return extension === "csv" || extension === "xlsx";
    });

    if (valid.length !== files.length) {
      notify("error", "Only CSV and XLSX files are supported.");
    }

    const oversized = valid.filter((file) => file.size > 25 * 1024 * 1024);
    if (oversized.length) {
      notify("error", "Each file must be 25 MB or smaller.");
    }

    const accepted = valid.filter(
      (file) => file.size <= 25 * 1024 * 1024
    );

    setSelectedFiles((previous) => {
      const combined = [...previous];
      accepted.forEach((file) => {
        if (!combined.some((item) => item.name === file.name)) {
          combined.push(file);
        }
      });
      return combined;
    });
  };

  const uploadDataset = async () => {
    if (!uploadName.trim()) {
      notify("error", "Enter a name for this dataset.");
      return;
    }
    if (!selectedFiles.length) {
      notify("error", "Select at least one CSV or Excel file.");
      return;
    }

    const formData = new FormData();
    formData.append("name", uploadName.trim());
    formData.append("description", uploadDescription.trim());
    selectedFiles.forEach((file) => formData.append("files", file));

    setBusyAction("upload");

    try {
      const result = await apiRequest("/upload", {
        method: "POST",
        body: formData,
      });

      const newId = result.dataset_id || result.dataset?.id;

      setUploadName("");
      setUploadDescription("");
      setSelectedFiles([]);
      setShowUpload(false);

      await loadDatasets();

      if (newId) {
        setSelectedDatasetId(newId);
      }

      notify("success", "Dataset uploaded and inspected successfully.");
    } catch (error: any) {
      notify("error", error.message);
    } finally {
      setBusyAction("");
    }
  };

  const analyzeDataset = async () => {
    const result = await runAction(
      "analyze",
      () =>
        apiRequest(`/datasets/${selectedDatasetId}/analyze`, {
          method: "POST",
        }),
      "Schema analysis completed.",
      false
    );

    if (result) {
      const nextAnalysis = result.analysis || result;
      setAnalysis(nextAnalysis);

      const candidates = collectMappingCandidates(nextAnalysis);
      if (candidates.length) {
        setMappingDrafts(candidates);
        setSelectedMapping(0);
      }

      await loadDatasetDetail(selectedDatasetId);
    }
  };

  const updateMapping = (
    index: number,
    canonicalField: string,
    sourceColumn: string
  ) => {
    setMappingDrafts((previous) =>
      previous.map((item, i) => {
        if (i !== index) return item;

        const mapping = { ...item.mapping };

        if (!sourceColumn) {
          delete mapping[canonicalField];
        } else {
          mapping[canonicalField] = sourceColumn;
        }

        return { ...item, mapping };
      })
    );
  };

  const updateMappingTable = (index: number, tableName: string) => {
    setMappingDrafts((previous) =>
      previous.map((item, i) =>
        i === index ? { ...item, table_name: tableName } : item
      )
    );
  };

  const submitMappings = async () => {
    if (!mappingDrafts.length) {
      notify("error", "No mapping suggestions are available.");
      return;
    }

    const payload = {
      mappings: mappingDrafts.map((item) => ({
        file: item.file,
        sheet: item.sheet,
        table_name: item.table_name,
        mapping: item.mapping,
      })),
    };

    const result = await runAction(
      "mappings",
      () =>
        apiRequest(`/datasets/${selectedDatasetId}/mappings`, {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      "Column mappings saved successfully."
    );

    if (result) setShowMappings(false);
  };

  const validateDataset = async () => {
    const result = await runAction(
      "validate",
      () =>
        apiRequest(`/datasets/${selectedDatasetId}/validate`, {
          method: "POST",
        }),
      "Structural validation completed."
    );

    if (result) {
      setValidationReport(result.report || result);
    }
  };

  const normalizeDataset = async () => {
    const result = await runAction(
      "normalize",
      () =>
        apiRequest(`/datasets/${selectedDatasetId}/normalize`, {
          method: "POST",
        }),
      "Dataset normalization completed."
    );

    if (result) setNormalizationReport(result);
  };

  const runQualityCheck = async () => {
    const result = await runAction(
      "quality",
      () =>
        apiRequest(`/datasets/${selectedDatasetId}/quality-check`, {
          method: "POST",
        }),
      "Data quality assessment completed."
    );

    if (result) setQualityReport(result);
  };

  const approveDataset = async () => {
    const confirmed = window.confirm(
      "Approve this uploaded dataset? It will become eligible for activation."
    );
    if (!confirmed) return;

    await runAction(
      "approve",
      () =>
        apiRequest(`/datasets/${selectedDatasetId}/approve`, {
          method: "POST",
        }),
      "Dataset approved and ready for activation."
    );
  };

  const activateDataset = async (datasetId: string) => {
    const confirmed = window.confirm(
      "Switch Janus AI to this dataset? The active workspace data source will change."
    );
    if (!confirmed) return;

    const result = await runAction(
      "activate",
      () =>
        apiRequest(`/datasets/${datasetId}/activate`, {
          method: "POST",
        }),
      "Active dataset switched successfully."
    );

    if (result) {
      setActiveDatasetId(datasetId);
      setSelectedDatasetId(datasetId);
    }
  };

  const getProfileSheets = () => {
    const profiles = datasetDetail?.dataset?.profile?.file_profiles || {};
    const output: {
      file: string;
      sheet: string;
      columns: string[];
    }[] = [];

    Object.entries(profiles).forEach(([file, profile]: [string, any]) => {
      Object.entries(profile?.sheets || {}).forEach(
        ([sheet, sheetData]: [string, any]) => {
          output.push({
            file,
            sheet,
            columns: (sheetData?.columns || []).map(
              (column: any) => column.name
            ),
          });
        }
      );
    });

    return output;
  };
    const mappingSheets = getProfileSheets();

  const ensureMappingDraft = (source: {
    file: string;
    sheet: string;
    columns: string[];
  }) => {
    setMappingDrafts((previous) => {
      if (
        previous.some(
          (item) => item.file === source.file && item.sheet === source.sheet
        )
      ) {
        return previous;
      }

      return [
        ...previous,
        {
          file: source.file,
          sheet: source.sheet,
          table_name: "materials",
          mapping: {},
        },
      ];
    });
    setShowMappings(true);
  };

  const activeDataset = datasets.find(
    (item) => item.id === activeDatasetId
  );

  const datasetStatus =
    selectedDataset?.status || datasetDetail?.dataset?.status || "unknown";

  const workflow = [
    {
      label: "Upload",
      complete: Boolean(selectedDataset),
      active: !selectedDataset,
    },
    {
      label: "Analyze",
      complete: Boolean(analysis),
      active: Boolean(selectedDataset) && !analysis,
    },
    {
      label: "Map",
      complete: ["confirmed", "validated"].includes(
        datasetDetail?.dataset?.mapping_status
      ),
      active: Boolean(analysis) && !datasetDetail?.dataset?.mapping_status,
    },
    {
      label: "Validate",
      complete: Boolean(validationReport?.valid),
      active: Boolean(datasetDetail?.dataset?.mapping_status === "confirmed"),
    },
    {
      label: "Normalize",
      complete:
        datasetDetail?.dataset?.normalization_status === "completed",
      active: Boolean(validationReport?.valid),
    },
    {
      label: "Quality",
      complete: Boolean(qualityReport),
      active:
        datasetDetail?.dataset?.normalization_status === "completed",
    },
    {
      label: "Activate",
      complete: datasetStatus === "ready" || activeDatasetId === selectedDatasetId,
      active: Boolean(qualityReport?.activation_allowed),
    },
  ];

  return (
    <div className="min-h-screen bg-[#080807] text-[#F1E8D8]">
      <div className="mx-auto max-w-[1600px] space-y-8 px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
        {/* HEADER */}
        <div className="flex flex-col justify-between gap-5 border-b border-white/[0.07] pb-7 xl:flex-row xl:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#C9A362]">
              <Database size={13} />
              Janus AI / Data Platform
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#F1E8D8] sm:text-4xl">
              Data Intelligence
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#898477]">
              Bring your utility data into GridStock. Inspect, map, validate,
              normalize and activate datasets across your intelligence
              workspaces.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => loadDatasets()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-[#C7BEAE] transition hover:border-[#C9A362]/40 hover:text-[#E6C98E] disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#C9A362] px-4 py-2.5 text-xs font-semibold text-[#17130C] transition hover:bg-[#E0BD7D]"
            >
              <Upload size={14} />
              Add dataset
            </button>
          </div>
        </div>

        {/* NOTICE */}
        {notice && (
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
              notice.type === "success"
                ? "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-200"
                : notice.type === "error"
                  ? "border-red-500/20 bg-red-500/[0.07] text-red-200"
                  : "border-[#C9A362]/20 bg-[#C9A362]/[0.07] text-[#E6C98E]"
            )}
          >
            {notice.type === "success" ? (
              <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
            )}
            <span className="flex-1">{notice.message}</span>
            <button onClick={() => setNotice(null)}>
              <X size={15} />
            </button>
          </div>
        )}

        {/* METRICS */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            label="Registered datasets"
            value={datasets.length}
            detail="Synthetic and uploaded"
            icon={Database}
          />
          <MetricCard
            label="Uploaded datasets"
            value={uploadedDatasets.length}
            detail="User-provided data sources"
            icon={FolderOpen}
          />
          <MetricCard
            label="Active source"
            value={
              activeDataset?.type === "synthetic"
                ? "Synthetic"
                : activeDataset?.type === "uploaded"
                  ? "Uploaded"
                  : "—"
            }
            detail={activeDataset?.name || "No active dataset"}
            icon={Zap}
          />
          <MetricCard
            label="Compatible workspaces"
            value={qualityReport ? `${readyWorkspaceCount}/5` : "—"}
            detail="For selected dataset"
            icon={Layers3}
          />
        </div>

        {/* ACTIVE DATA SOURCE */}
        <section className="rounded-xl border border-[#C9A362]/20 bg-gradient-to-r from-[#17130D] to-[#0D0D0B] p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#C9A362]/25 bg-[#C9A362]/10 text-[#D9B979]">
                <Activity size={20} />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C9A362]">
                  Currently powering GridStock
                </div>
                <div className="mt-1 text-lg font-semibold text-[#F1E8D8]">
                  {activeDataset?.name || "Loading active dataset…"}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#938A7B]">
                  <span>{activeDataset?.type === "synthetic" ? "Synthetic Demo" : "Uploaded Dataset"}</span>
                  <span className="text-[#5B554B]">•</span>
                  <span className="font-mono">{activeDatasetId || "—"}</span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider",
                      statusTone("active")
                    )}
                  >
                    Active
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[10px] uppercase tracking-[0.15em] text-[#8D8578]">
                Switch source
              </label>
              <select
                value={activeDatasetId}
                onChange={(event) => {
                  if (event.target.value) activateDataset(event.target.value);
                }}
                className="min-w-[220px] rounded-lg border border-white/10 bg-[#090908] px-3 py-2.5 text-xs text-[#E6D7BC] outline-none focus:border-[#C9A362]/60"
              >
                {datasets.map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.type === "synthetic" ? "Synthetic Demo" : dataset.name}
                    {dataset.type === "uploaded" ? ` · ${dataset.status || "processing"}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* WORKFLOW */}
        <section className="rounded-xl border border-white/[0.07] bg-[#0C0C0A] p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C9A362]">
                Dataset lifecycle
              </div>
              <h2 className="mt-1 text-lg font-semibold text-[#F1E8D8]">
                Upload to activation
              </h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] text-[#928A7D]">
              {selectedDataset ? selectedDataset.name : "No dataset selected"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-y-4 sm:grid-cols-4 xl:grid-cols-7">
            {workflow.map((step, index) => (
              <StepIndicator
                key={step.label}
                number={index + 1}
                label={step.label}
                active={step.active}
                complete={step.complete}
              />
            ))}
          </div>
        </section>

        {/* DATASET LIBRARY */}
        <section className="space-y-4">
          <SectionHeading
            eyebrow="01 / Dataset library"
            title="Your data sources"
            description="Select a dataset to inspect its files, review its processing status and manage its compatibility."
            right={
              <div className="text-xs text-[#777166]">
                {datasets.length} registered source{datasets.length === 1 ? "" : "s"}
              </div>
            }
          />

          <div className="grid gap-4 xl:grid-cols-3">
            {/* SYNTHETIC */}
            {syntheticDataset && (
              <button
                onClick={() => setSelectedDatasetId(syntheticDataset.id)}
                className={cn(
                  "group rounded-xl border p-5 text-left transition",
                  selectedDatasetId === syntheticDataset.id
                    ? "border-[#C9A362]/50 bg-[#17130D]"
                    : "border-white/[0.07] bg-[#0D0D0B] hover:border-white/20"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#C9A362]/20 bg-[#C9A362]/10 text-[#C9A362]">
                    <Sparkles size={19} />
                  </div>
                  <span className="rounded-full border border-[#C9A362]/25 bg-[#C9A362]/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-[#D7B778]">
                    Built-in
                  </span>
                </div>
                <div className="mt-5 text-base font-semibold text-[#F1E8D8]">
                  Synthetic Demo
                </div>
                <p className="mt-1 text-xs leading-5 text-[#898477]">
                  GridStock's demonstration dataset. Preserved independently
                  from uploaded files.
                </p>
                <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-3">
                  <span className="text-[10px] uppercase tracking-wider text-[#777166]">
                    Always available
                  </span>
                  {activeDatasetId === syntheticDataset.id ? (
                    <span className="text-[10px] font-semibold text-emerald-300">
                      Active source
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-[#C9A362]">
                      Inspect <ArrowUpRight size={12} />
                    </span>
                  )}
                </div>
              </button>
            )}

            {/* UPLOADED DATASETS */}
            {uploadedDatasets.map((dataset) => (
              <button
                key={dataset.id}
                onClick={() => setSelectedDatasetId(dataset.id)}
                className={cn(
                  "rounded-xl border p-5 text-left transition",
                  selectedDatasetId === dataset.id
                    ? "border-[#C9A362]/50 bg-[#17130D]"
                    : "border-white/[0.07] bg-[#0D0D0B] hover:border-white/20"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[#C9A362]">
                    <FileSpreadsheet size={19} />
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider",
                      statusTone(dataset.status)
                    )}
                  >
                    {dataset.status || "processing"}
                  </span>
                </div>
                <div className="mt-5 truncate text-base font-semibold text-[#F1E8D8]">
                  {dataset.name}
                </div>
                <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-[#898477]">
                  {dataset.description || "Uploaded utility dataset"}
                </p>
                <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-3">
                  <span className="text-[10px] text-[#777166]">
                    {formatDate(dataset.created_at)}
                  </span>
                  {activeDatasetId === dataset.id ? (
                    <span className="text-[10px] font-semibold text-emerald-300">
                      Active source
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-[#C9A362]">
                      Inspect <ArrowUpRight size={12} />
                    </span>
                  )}
                </div>
              </button>
            ))}

            <button
              onClick={() => setShowUpload(true)}
              className="flex min-h-[190px] flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.015] p-5 text-center transition hover:border-[#C9A362]/50 hover:bg-[#C9A362]/[0.035]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#C9A362]/25 bg-[#C9A362]/10 text-[#C9A362]">
                <Upload size={19} />
              </div>
              <div className="mt-3 text-sm font-semibold text-[#E6D7BC]">
                Add another dataset
              </div>
              <div className="mt-1 text-xs text-[#777166]">
                Import CSV or Excel workbooks
              </div>
            </button>
          </div>
        </section>

        {/* SELECTED DATASET WORKSPACE */}
        {selectedDataset && (
          <section className="space-y-5">
            <div className="flex flex-col justify-between gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-end">
              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C9A362]">
                  02 / Selected dataset
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold text-[#F1E8D8]">
                    {selectedDataset.name}
                  </h2>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-wider",
                      statusTone(datasetStatus)
                    )}
                  >
                    {datasetStatus}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] text-[#716B60]">
                  {selectedDataset.id}
                </p>
              </div>
              {selectedDataset.type === "uploaded" &&
                activeDatasetId !== selectedDataset.id && (
                  <button
                    onClick={() => activateDataset(selectedDataset.id)}
                    disabled={datasetStatus !== "ready" || busyAction === "activate"}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C9A362] px-4 py-2.5 text-xs font-semibold text-[#17130C] transition hover:bg-[#E0BD7D] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busyAction === "activate" ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Zap size={14} />
                    )}
                    Activate dataset
                  </button>
                )}
            </div>

            {selectedDataset.type === "synthetic" ? (
              <div className="rounded-xl border border-[#C9A362]/20 bg-[#11100C] p-5">
                <div className="flex items-start gap-3">
                  <Sparkles size={19} className="mt-0.5 text-[#C9A362]" />
                  <div>
                    <h3 className="text-sm font-semibold text-[#E6D7BC]">
                      Synthetic Demo dataset
                    </h3>
                    <p className="mt-1 max-w-3xl text-xs leading-6 text-[#928A7D]">
                      This is GridStock's built-in demonstration source. Its
                      generated utility data remains separate from uploaded
                      datasets. Select an uploaded dataset from the library to
                      begin the import and compatibility workflow.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* SOURCE FILES */}
                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-xl border border-white/[0.07] bg-[#0D0D0B] p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C9A362]">
                          Uploaded source files
                        </div>
                        <h3 className="mt-1 text-base font-semibold text-[#F1E8D8]">
                          File inventory
                        </h3>
                      </div>
                      <FileText size={18} className="text-[#8B806D]" />
                    </div>

                    <div className="mt-4 space-y-2">
                      {Object.entries(
                        datasetDetail?.dataset?.profile?.file_profiles || {}
                      ).map(([filename, profile]: [string, any]) => (
                        <div
                          key={filename}
                          className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#C9A362]/10 text-[#C9A362]">
                            <FileSpreadsheet size={17} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium text-[#E5DCCB]">
                              {filename}
                            </div>
                            <div className="mt-1 text-[10px] text-[#777166]">
                              {Object.keys(profile?.sheets || {}).length} sheet(s)
                              {" · "}
                              {Object.values(profile?.sheets || {}).reduce(
                                (sum: number, sheet: any) =>
                                  sum + (sheet?.row_count || 0),
                                0
                              ).toLocaleString()}{" "}
                              rows
                            </div>
                          </div>
                          <CheckCircle2 size={15} className="text-emerald-400" />
                        </div>
                      ))}

                      {!Object.keys(
                        datasetDetail?.dataset?.profile?.file_profiles || {}
                      ).length && (
                        <div className="rounded-lg border border-dashed border-white/10 p-5 text-center text-xs text-[#777166]">
                          File profiles will appear after upload inspection.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.07] bg-[#0D0D0B] p-5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C9A362]">
                      Processing controls
                    </div>
                    <h3 className="mt-1 text-base font-semibold text-[#F1E8D8]">
                      Dataset pipeline
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-[#898477]">
                      Each stage builds on the previous stage. Review the
                      analysis and mappings before proceeding.
                    </p>

                    <div className="mt-4 space-y-2">
                      <button
                        onClick={analyzeDataset}
                        disabled={Boolean(busyAction)}
                        className="flex w-full items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-3 text-left transition hover:border-[#C9A362]/40 disabled:opacity-50"
                      >
                        <span className="flex items-center gap-3">
                          <Activity size={16} className="text-[#C9A362]" />
                          <span>
                            <span className="block text-xs font-medium text-[#E6D7BC]">
                              Analyze dataset
                            </span>
                            <span className="mt-0.5 block text-[10px] text-[#777166]">
                              Identify tables and suggest mappings
                            </span>
                          </span>
                        </span>
                        {busyAction === "analyze" ? (
                          <Loader2 size={15} className="animate-spin text-[#C9A362]" />
                        ) : (
                          <ArrowRight size={15} className="text-[#8B806D]" />
                        )}
                      </button>

                      <button
                        onClick={() => setShowMappings((value) => !value)}
                        disabled={!mappingDrafts.length}
                        className="flex w-full items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-3 text-left transition hover:border-[#C9A362]/40 disabled:opacity-40"
                      >
                        <span className="flex items-center gap-3">
                          <Layers3 size={16} className="text-[#C9A362]" />
                          <span>
                            <span className="block text-xs font-medium text-[#E6D7BC]">
                              Review column mappings
                            </span>
                            <span className="mt-0.5 block text-[10px] text-[#777166]">
                              Confirm source-to-JANUS AIfields
                            </span>
                          </span>
                        </span>
                        <ChevronRight size={15} className="text-[#8B806D]" />
                      </button>

                      <button
                        onClick={validateDataset}
                        disabled={
                          !datasetDetail?.dataset?.confirmed_mappings?.length ||
                          Boolean(busyAction)
                        }
                        className="flex w-full items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-3 text-left transition hover:border-[#C9A362]/40 disabled:opacity-40"
                      >
                        <span className="flex items-center gap-3">
                          <ShieldCheck size={16} className="text-[#C9A362]" />
                          <span>
                            <span className="block text-xs font-medium text-[#E6D7BC]">
                              Validate mappings
                            </span>
                            <span className="mt-0.5 block text-[10px] text-[#777166]">
                              Check canonical schema requirements
                            </span>
                          </span>
                        </span>
                        {busyAction === "validate" ? (
                          <Loader2 size={15} className="animate-spin text-[#C9A362]" />
                        ) : (
                          <ArrowRight size={15} className="text-[#8B806D]" />
                        )}
                      </button>

                      <button
                        onClick={normalizeDataset}
                        disabled={
                          !validationReport?.valid ||
                          !datasetDetail?.dataset?.confirmed_mappings?.length ||
                          Boolean(busyAction)
                        }
                        className="flex w-full items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-3 text-left transition hover:border-[#C9A362]/40 disabled:opacity-40"
                      >
                        <span className="flex items-center gap-3">
                          <Database size={16} className="text-[#C9A362]" />
                          <span>
                            <span className="block text-xs font-medium text-[#E6D7BC]">
                              Normalize dataset
                            </span>
                            <span className="mt-0.5 block text-[10px] text-[#777166]">
                              Generate canonical normalized tables
                            </span>
                          </span>
                        </span>
                        {busyAction === "normalize" ? (
                          <Loader2 size={15} className="animate-spin text-[#C9A362]" />
                        ) : (
                          <ArrowRight size={15} className="text-[#8B806D]" />
                        )}
                      </button>

                      <button
                        onClick={runQualityCheck}
                        disabled={
                          datasetDetail?.dataset?.normalization_status !== "completed" ||
                          Boolean(busyAction)
                        }
                        className="flex w-full items-center justify-between rounded-lg border border-[#C9A362]/20 bg-[#C9A362]/[0.045] px-3 py-3 text-left transition hover:border-[#C9A362]/50 disabled:opacity-40"
                      >
                        <span className="flex items-center gap-3">
                          <Sparkles size={16} className="text-[#D8B778]" />
                          <span>
                            <span className="block text-xs font-medium text-[#E6D7BC]">
                              Run quality assessment
                            </span>
                            <span className="mt-0.5 block text-[10px] text-[#928A7D]">
                              Score data and check workspace readiness
                            </span>
                          </span>
                        </span>
                        {busyAction === "quality" ? (
                          <Loader2 size={15} className="animate-spin text-[#C9A362]" />
                        ) : (
                          <ArrowRight size={15} className="text-[#C9A362]" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ANALYSIS */}
                {analysis && (
                  <div className="rounded-xl border border-white/[0.07] bg-[#0D0D0B] p-5">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C9A362]">
                          Schema intelligence
                        </div>
                        <h3 className="mt-1 text-base font-semibold text-[#F1E8D8]">
                          Analysis results
                        </h3>
                      </div>
                      <button
                        onClick={() => setShowMappings((value) => !value)}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#C9A362]/25 px-3 py-2 text-xs text-[#E6C98E] hover:bg-[#C9A362]/10"
                      >
                        {showMappings ? "Hide mapping editor" : "Open mapping editor"}
                        <ChevronDown size={13} />
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg bg-white/[0.025] p-3">
                        <div className="text-[10px] uppercase tracking-wider text-[#777166]">
                          Suggested mappings
                        </div>
                        <div className="mt-1 text-xl font-semibold text-[#F1E8D8]">
                          {mappingDrafts.length}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white/[0.025] p-3">
                        <div className="text-[10px] uppercase tracking-wider text-[#777166]">
                          Confirmed mappings
                        </div>
                        <div className="mt-1 text-xl font-semibold text-[#F1E8D8]">
                          {datasetDetail?.dataset?.confirmed_mappings?.length || 0}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white/[0.025] p-3">
                        <div className="text-[10px] uppercase tracking-wider text-[#777166]">
                          Mapping status
                        </div>
                        <div className="mt-2">
                          <span
                            className={cn(
                              "rounded-full border px-2 py-1 text-[9px] uppercase tracking-wider",
                              statusTone(datasetDetail?.dataset?.mapping_status)
                            )}
                          >
                            {datasetDetail?.dataset?.mapping_status || "Review required"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* MAPPING EDITOR */}
                {showMappings && (
                  <div className="rounded-xl border border-[#C9A362]/25 bg-[#11100C] p-5">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C9A362]">
                          Mapping studio
                        </div>
                        <h3 className="mt-1 text-base font-semibold text-[#F1E8D8]">
                          Confirm source columns
                        </h3>
                        <p className="mt-1 text-xs text-[#898477]">
                          Review each suggested mapping. Choose the uploaded
                          column that corresponds to each canonical field.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowMappings(false)}
                        className="self-end rounded-lg p-1.5 text-[#8B806D] hover:bg-white/5 hover:text-white sm:self-start"
                      >
                        <X size={16} />
                      </button>
                    </div>
                                        {mappingDrafts.length > 0 ? (
                      <div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr]">
                        <div className="space-y-2">
                          {mappingDrafts.map((item, index) => (
                            <button
                              key={`${item.file}-${item.sheet}-${index}`}
                              onClick={() => setSelectedMapping(index)}
                              className={cn(
                                "w-full rounded-lg border p-3 text-left transition",
                                selectedMapping === index
                                  ? "border-[#C9A362]/40 bg-[#C9A362]/[0.08]"
                                  : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"
                              )}
                            >
                              <div className="truncate text-xs font-medium text-[#E6D7BC]">
                                {item.file}
                              </div>
                              <div className="mt-1 text-[10px] text-[#777166]">
                                {item.sheet} · {pretty(item.table_name)}
                              </div>
                            </button>
                          ))}
                        </div>

                        {mappingDrafts[selectedMapping] && (
                          <div className="min-w-0">
                            <div className="mb-4 grid gap-3 sm:grid-cols-2">
                              <div>
                                <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[#898477]">
                                  Source sheet
                                </label>
                                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-[#D6CBB7]">
                                  {mappingDrafts[selectedMapping].file} /{" "}
                                  {mappingDrafts[selectedMapping].sheet}
                                </div>
                              </div>
                              <div>
                                <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[#898477]">
                                  Canonical table
                                </label>
                                <select
                                  value={mappingDrafts[selectedMapping].table_name}
                                  onChange={(event) =>
                                    updateMappingTable(
                                      selectedMapping,
                                      event.target.value
                                    )
                                  }
                                  className="w-full rounded-lg border border-white/10 bg-[#090908] px-3 py-2.5 text-xs text-[#E6D7BC] outline-none focus:border-[#C9A362]/60"
                                >
                                  {TABLE_OPTIONS.map((table) => (
                                    <option key={table} value={table}>
                                      {pretty(table)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {(() => {
                              const source = mappingSheets.find(
                                (item) =>
                                  item.file === mappingDrafts[selectedMapping].file &&
                                  item.sheet === mappingDrafts[selectedMapping].sheet
                              );

                              const columns = source?.columns || [];
                              const mapping = mappingDrafts[selectedMapping].mapping;

                              return (
                                <div className="overflow-hidden rounded-lg border border-white/[0.07]">
                                  <div className="grid grid-cols-[1fr_1.2fr] gap-3 border-b border-white/[0.07] bg-white/[0.035] px-3 py-2.5">
                                    <div className="text-[9px] font-semibold uppercase tracking-wider text-[#8D8578]">
                                      JANUS AIfield
                                    </div>
                                    <div className="text-[9px] font-semibold uppercase tracking-wider text-[#8D8578]">
                                      Uploaded column
                                    </div>
                                  </div>

                                  {Object.keys(mapping).length ? (
                                    Object.entries(mapping).map(
                                      ([canonical, sourceColumn]) => (
                                        <div
                                          key={canonical}
                                          className="grid grid-cols-[1fr_1.2fr] items-center gap-3 border-b border-white/[0.05] px-3 py-2.5 last:border-0"
                                        >
                                          <div className="truncate text-xs text-[#D9CFBD]">
                                            {pretty(canonical)}
                                          </div>
                                          <select
                                            value={sourceColumn}
                                            onChange={(event) =>
                                              updateMapping(
                                                selectedMapping,
                                                canonical,
                                                event.target.value
                                              )
                                            }
                                            className="min-w-0 rounded-md border border-white/10 bg-[#090908] px-2 py-2 text-xs text-[#D6CBB7] outline-none focus:border-[#C9A362]/60"
                                          >
                                            <option value="">
                                              Not mapped
                                            </option>
                                            {columns.map((column) => (
                                              <option key={column} value={column}>
                                                {column}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      )
                                    )
                                  ) : (
                                    <div className="p-4 text-xs text-[#777166]">
                                      No suggested field mappings were returned
                                      for this sheet. Run schema analysis again
                                      or inspect the source file columns.
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                              <span className="text-[10px] text-[#777166]">
                                {Object.keys(mappingDrafts[selectedMapping].mapping).length} field(s) mapped
                              </span>
                              <div className="flex gap-2">
                                {mappingSheets.length > 0 && (
                                  <button
                                    onClick={() => {
                                      const unmapped = mappingSheets.find(
                                        (source) =>
                                          !mappingDrafts.some(
                                            (item) =>
                                              item.file === source.file &&
                                              item.sheet === source.sheet
                                          )
                                      );
                                      if (unmapped) ensureMappingDraft(unmapped);
                                    }}
                                    className="rounded-lg border border-white/10 px-3 py-2 text-[10px] text-[#B7AE9F] hover:border-white/20"
                                  >
                                    Add sheet
                                  </button>
                                )}
                                <button
                                  onClick={submitMappings}
                                  disabled={Boolean(busyAction)}
                                  className="inline-flex items-center gap-2 rounded-lg bg-[#C9A362] px-4 py-2 text-[10px] font-semibold text-[#17130C] hover:bg-[#E0BD7D] disabled:opacity-50"
                                >
                                  {busyAction === "mappings" ? (
                                    <Loader2 size={13} className="animate-spin" />
                                  ) : (
                                    <Check size={13} />
                                  )}
                                  Save mappings
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-lg border border-dashed border-white/10 p-5 text-center">
                        <p className="text-xs text-[#898477]">
                          Run schema analysis to generate mapping suggestions.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* MANUAL SHEET MAPPING FALLBACK */}
                {analysis && mappingSheets.length > 0 && mappingDrafts.length === 0 && (
                  <div className="rounded-xl border border-white/[0.07] bg-[#0D0D0B] p-5">
                    <div className="text-sm font-semibold text-[#E6D7BC]">
                      Source sheets
                    </div>
                    <p className="mt-1 text-xs text-[#898477]">
                      Add a sheet to the mapping editor if automatic mapping
                      suggestions were not available.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {mappingSheets.map((source) => (
                        <button
                          key={`${source.file}-${source.sheet}`}
                          onClick={() => ensureMappingDraft(source)}
                          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-[#C9BEAC] hover:border-[#C9A362]/40"
                        >
                          + {source.file} / {source.sheet}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* VALIDATION + NORMALIZATION */}
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-xl border border-white/[0.07] bg-[#0D0D0B] p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C9A362]">
                          Structural validation
                        </div>
                        <h3 className="mt-1 text-base font-semibold text-[#F1E8D8]">
                          Mapping validation
                        </h3>
                      </div>
                      <ShieldCheck size={19} className="text-[#C9A362]" />
                    </div>
                    {validationReport ? (
                      <div className="mt-4">
                        <div className="flex items-center gap-2">
                          {validationReport.valid ? (
                            <CheckCircle2 size={17} className="text-emerald-400" />
                          ) : (
                            <AlertTriangle size={17} className="text-amber-300" />
                          )}
                          <span className="text-sm font-medium text-[#E6D7BC]">
                            {validationReport.valid
                              ? "Structural validation passed"
                              : "Validation needs attention"}
                          </span>
                        </div>
                        <pre className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-[10px] leading-5 text-[#A9A092]">
                          {JSON.stringify(validationReport, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <p className="mt-4 text-xs leading-6 text-[#777166]">
                        Confirm your column mappings, then run validation to
                        check canonical table requirements.
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-white/[0.07] bg-[#0D0D0B] p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C9A362]">
                          Canonical data preparation
                        </div>
                        <h3 className="mt-1 text-base font-semibold text-[#F1E8D8]">
                          Normalization report
                        </h3>
                      </div>
                      <Database size={19} className="text-[#C9A362]" />
                    </div>
                    {normalizationReport ? (
                      <div className="mt-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={17} className="text-emerald-400" />
                          <span className="text-sm font-medium text-[#E6D7BC]">
                            Normalization report available
                          </span>
                        </div>
                        <pre className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-[10px] leading-5 text-[#A9A092]">
                          {JSON.stringify(normalizationReport, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <p className="mt-4 text-xs leading-6 text-[#777166]">
                        Once structural validation passes, normalize the
                        uploaded source tables into GridStock's canonical
                        format.
                      </p>
                    )}
                  </div>
                </div>

                {/* QUALITY REPORT */}
                <div className="rounded-xl border border-white/[0.07] bg-[#0D0D0B] p-5 sm:p-6">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C9A362]">
                        03 / Data quality intelligence
                      </div>
                      <h3 className="mt-1 text-lg font-semibold text-[#F1E8D8]">
                        Quality & compatibility assessment
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-[#898477]">
                        Evaluate missing values, duplicates, data types,
                        relationships and module-specific requirements.
                      </p>
                    </div>
                    <button
                      onClick={runQualityCheck}
                      disabled={
                        datasetDetail?.dataset?.normalization_status !== "completed" ||
                        Boolean(busyAction)
                      }
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[#C9A362]/30 bg-[#C9A362]/[0.07] px-4 py-2.5 text-xs font-semibold text-[#E6C98E] transition hover:bg-[#C9A362]/15 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {busyAction === "quality" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Play size={13} />
                      )}
                      Run assessment
                    </button>
                  </div>

                  {qualityReport ? (
                    <div className="mt-6 space-y-5">
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-lg border border-white/[0.07] bg-black/20 p-4">
                          <div className="text-[10px] uppercase tracking-wider text-[#777166]">
                            Quality score
                          </div>
                          <div className="mt-2 flex items-end gap-1">
                            <span className="text-3xl font-semibold text-[#E6C98E]">
                              {qualityReport.quality_score ?? "—"}
                            </span>
                            <span className="mb-1 text-xs text-[#777166]">/100</span>
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/[0.07] bg-black/20 p-4">
                          <div className="text-[10px] uppercase tracking-wider text-[#777166]">
                            Tables available
                          </div>
                          <div className="mt-2 text-3xl font-semibold text-[#F1E8D8]">
                            {qualityReport.summary?.tables_available ?? 0}
                            <span className="ml-1 text-sm text-[#777166]">
                              / {qualityReport.summary?.total_tables ?? 8}
                            </span>
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/[0.07] bg-black/20 p-4">
                          <div className="text-[10px] uppercase tracking-wider text-[#777166]">
                            Blocking errors
                          </div>
                          <div className="mt-2 text-3xl font-semibold text-red-300">
                            {qualityReport.summary?.error_count ?? 0}
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/[0.07] bg-black/20 p-4">
                          <div className="text-[10px] uppercase tracking-wider text-[#777166]">
                            Warnings
                          </div>
                          <div className="mt-2 text-3xl font-semibold text-amber-200">
                            {qualityReport.summary?.warning_count ?? 0}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-[#E6D7BC]">
                            Workspace compatibility
                          </h4>
                          <span className="text-[10px] text-[#777166]">
                            {readyWorkspaceCount} of 5 ready
                          </span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                          {Object.entries(
                            qualityReport.workspace_compatibility || {}
                          ).map(([workspace, result]: [string, any]) => (
                            <div
                              key={workspace}
                              className="rounded-lg border border-white/[0.07] bg-black/20 p-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium text-[#D8CEBD]">
                                  {pretty(workspace)}
                                </span>
                                {result.ready ? (
                                  <CheckCircle2 size={15} className="text-emerald-400" />
                                ) : (
                                  <AlertCircle size={15} className="text-amber-300" />
                                )}
                              </div>
                              <div className="mt-2">
                                <span
                                  className={cn(
                                    "rounded-full border px-2 py-1 text-[9px] uppercase tracking-wider",
                                    statusTone(result.status)
                                  )}
                                >
                                  {result.status || "unavailable"}
                                </span>
                              </div>
                              {result.missing_tables?.length > 0 && (
                                <p className="mt-2 text-[10px] leading-4 text-[#8A8174]">
                                  Missing: {result.missing_tables.map(pretty).join(", ")}
                                </p>
                              )}
                              {result.missing_columns?.length > 0 && (
                                <p className="mt-2 text-[10px] leading-4 text-[#8A8174]">
                                  Missing fields:{" "}
                                  {result.missing_columns
                                    .map((item: any) =>
                                      `${item.table}: ${item.columns.join(", ")}`
                                    )
                                    .join("; ")}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-[#E6D7BC]">
                            Quality findings
                          </h4>
                          <span className="text-[10px] text-[#777166]">
                            {(qualityReport.issues || []).length} finding(s)
                          </span>
                        </div>
                        <div className="max-h-72 space-y-2 overflow-auto">
                          {(qualityReport.issues || []).length ? (
                            qualityReport.issues.map((issue: any, index: number) => (
                              <div
                                key={`${issue.code}-${index}`}
                                className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-black/20 p-3"
                              >
                                {issue.severity === "error" ? (
                                  <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-300" />
                                ) : (
                                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-300" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs leading-5 text-[#D7CEBF]">
                                    {issue.message}
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-2 text-[9px] uppercase tracking-wider text-[#777166]">
                                    <span>{issue.code}</span>
                                    {issue.table && <span>· {issue.table}</span>}
                                    {issue.count !== undefined && (
                                      <span>· {issue.count} record(s)</span>
                                    )}
                                  </div>
                                </div>
                                <span
                                  className={cn(
                                    "rounded-full border px-2 py-0.5 text-[8px] uppercase tracking-wider",
                                    issue.severity === "error"
                                      ? "border-red-500/20 bg-red-500/10 text-red-300"
                                      : "border-amber-500/20 bg-amber-500/10 text-amber-200"
                                  )}
                                >
                                  {issue.severity}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-4 text-xs text-emerald-200">
                              No quality findings were reported.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col justify-between gap-4 rounded-lg border border-[#C9A362]/20 bg-[#C9A362]/[0.045] p-4 sm:flex-row sm:items-center">
                        <div>
                          <div className="text-xs font-semibold text-[#E6D7BC]">
                            Dataset approval
                          </div>
                          <p className="mt-1 text-[10px] leading-5 text-[#928A7D]">
                            {qualityReport.activation_allowed
                              ? "Quality checks allow this dataset to be submitted for approval."
                              : "Resolve blocking errors and ensure at least one workspace is ready before approval."}
                          </p>
                        </div>
                        <button
                          onClick={approveDataset}
                          disabled={
                            !qualityReport.activation_allowed ||
                            datasetStatus === "ready" ||
                            Boolean(busyAction)
                          }
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#C9A362] px-4 py-2.5 text-xs font-semibold text-[#17130C] transition hover:bg-[#E0BD7D] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {busyAction === "approve" ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={14} />
                          )}
                          {datasetStatus === "ready" ? "Approved" : "Approve dataset"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 px-5 py-10 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#C9A362]/20 bg-[#C9A362]/[0.06] text-[#C9A362]">
                        <ShieldCheck size={21} />
                      </div>
                      <h4 className="mt-3 text-sm font-medium text-[#E6D7BC]">
                        Quality assessment not run yet
                      </h4>
                      <p className="mt-1 max-w-md text-xs leading-5 text-[#777166]">
                        Normalize your dataset first. JANUS AIwill then inspect
                        data integrity and identify which workspaces can use it.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {/* EMPTY STATE */}
        {!selectedDataset && !loading && (
          <div className="rounded-xl border border-dashed border-white/15 bg-[#0D0D0B] px-5 py-16 text-center">
            <Database size={27} className="mx-auto text-[#C9A362]" />
            <h3 className="mt-4 text-lg font-semibold text-[#E6D7BC]">
              No dataset selected
            </h3>
            <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-[#898477]">
              Choose Synthetic Demo or upload your own utility data to begin
              working with GridStock's Data Intelligence pipeline.
            </p>
            <button
              onClick={() => setShowUpload(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#C9A362] px-4 py-2.5 text-xs font-semibold text-[#17130C] hover:bg-[#E0BD7D]"
            >
              <Upload size={14} />
              Upload dataset
            </button>
          </div>
        )}

        {/* UPLOAD MODAL */}
        {showUpload && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
            <div className="my-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-[#10100E] shadow-2xl shadow-black/50">
              <div className="flex items-start justify-between border-b border-white/[0.07] p-5 sm:p-6">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C9A362]">
                    New data source
                  </div>
                  <h2 className="mt-1 text-xl font-semibold text-[#F1E8D8]">
                    Upload utility dataset
                  </h2>
                  <p className="mt-1 text-xs text-[#898477]">
                    Add one or more CSV or Excel files to a new dataset.
                  </p>
                </div>
                <button
                  onClick={() => setShowUpload(false)}
                  className="rounded-lg p-2 text-[#898477] hover:bg-white/5 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.15em] text-[#A69C8B]">
                    Dataset name <span className="text-[#C9A362]">*</span>
                  </label>
                  <input
                    value={uploadName}
                    onChange={(event) => setUploadName(event.target.value)}
                    placeholder="e.g. Gujarat Utility Operations 2026"
                    className="w-full rounded-lg border border-white/10 bg-black/25 px-3.5 py-3 text-sm text-[#E6D7BC] outline-none placeholder:text-[#5F5A51] focus:border-[#C9A362]/60"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.15em] text-[#A69C8B]">
                    Description
                  </label>
                  <textarea
                    value={uploadDescription}
                    onChange={(event) => setUploadDescription(event.target.value)}
                    rows={2}
                    placeholder="Briefly describe the source and time period..."
                    className="w-full resize-none rounded-lg border border-white/10 bg-black/25 px-3.5 py-3 text-sm text-[#E6D7BC] outline-none placeholder:text-[#5F5A51] focus:border-[#C9A362]/60"
                  />
                </div>

                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    addFiles(event.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "cursor-pointer rounded-xl border border-dashed p-8 text-center transition",
                    dragging
                      ? "border-[#C9A362] bg-[#C9A362]/10"
                      : "border-white/15 bg-white/[0.015] hover:border-[#C9A362]/50 hover:bg-[#C9A362]/[0.035]"
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      if (event.target.files) addFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[#C9A362]/25 bg-[#C9A362]/10 text-[#C9A362]">
                    <Upload size={21} />
                  </div>
                  <div className="mt-3 text-sm font-semibold text-[#E6D7BC]">
                    Drop files here or browse
                  </div>
                  <div className="mt-1 text-xs text-[#777166]">
                    CSV and XLSX · Maximum 25 MB per file
                  </div>
                </div>

                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#A69C8B]">
                        Selected files ({selectedFiles.length})
                      </span>
                      <button
                        onClick={() => setSelectedFiles([])}
                        className="text-[10px] text-[#B88C66] hover:text-[#E0BD7D]"
                      >
                        Remove all
                      </button>
                    </div>
                    {selectedFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2.5"
                      >
                        <FileSpreadsheet size={16} className="shrink-0 text-[#C9A362]" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs text-[#D9CFBD]">
                            {file.name}
                          </div>
                          <div className="text-[10px] text-[#777166]">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </div>
                        </div>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedFiles((previous) =>
                              previous.filter((_, i) => i !== index)
                            );
                          }}
                          className="rounded p-1 text-[#777166] hover:text-red-300"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col-reverse justify-end gap-2 border-t border-white/[0.07] pt-4 sm:flex-row">
                  <button
                    onClick={() => setShowUpload(false)}
                    className="rounded-lg border border-white/10 px-4 py-2.5 text-xs text-[#B7AE9F] hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={uploadDataset}
                    disabled={
                      busyAction === "upload" ||
                      !uploadName.trim() ||
                      !selectedFiles.length
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C9A362] px-5 py-2.5 text-xs font-semibold text-[#17130C] transition hover:bg-[#E0BD7D] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busyAction === "upload" ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Upload size={14} />
                        Upload and inspect
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="flex flex-col justify-between gap-2 border-t border-white/[0.06] pt-5 text-[9px] uppercase tracking-[0.16em] text-[#5F5A50] sm:flex-row">
          <span>Janus AI · DATA INTELLIGENCE</span>
          <span>Dataset isolation · Explicit approval · Source-aware workspaces</span>
        </div>
      </div>
    </div>
  );
}