"use client";

import { useEffect, useState } from "react";
import { Database, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";

const API_BASE = "http://localhost:8000/api/data-intelligence";

type WorkspaceResult = {
  compatible: boolean;
  status: string;
  reason?: string;
  missing_tables?: string[];
  missing_columns?: {
    table: string;
    columns: string[];
  }[];
  blocking_issues?: {
    code?: string;
    message?: string;
  }[];
};

type ActiveSource = {
  dataset_id: string;
  dataset_name: string;
  dataset_type: "synthetic" | "uploaded";
  dataset_status: string;
  workspace_compatibility: Record<string, WorkspaceResult>;
};

type Props = {
  workspace: string;
};

export default function ActiveDataSource({ workspace }: Props) {
  const [source, setSource] = useState<ActiveSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadSource = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE}/workspaces/active`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to retrieve active dataset information.");
        }

        const data: ActiveSource = await response.json();

        if (!cancelled) {
          setSource(data);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Data source unavailable.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadSource();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="mb-5 flex items-center gap-2 rounded-lg border border-white/[0.07] bg-[#0D0D0B] px-4 py-3 text-xs text-[#A69B88]">
        <Loader2 size={14} className="animate-spin text-[#C9A362]" />
        Checking active data source...
      </div>
    );
  }

  if (error || !source) {
    return (
      <div className="mb-5 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.05] px-4 py-3 text-xs text-red-300">
        <AlertTriangle size={14} />
        {error || "Data source information unavailable."}
      </div>
    );
  }

  const result = source.workspace_compatibility?.[workspace];
  const compatible = result?.compatible === true;

  return (
    <div className="mb-5 flex flex-col justify-between gap-3 rounded-lg border border-[#C9A362]/15 bg-[#0D0D0B] px-4 py-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <Database size={17} className="shrink-0 text-[#C9A362]" />

        <div>
          <p className="text-[9px] uppercase tracking-[0.17em] text-[#847B6D]">
            Active data source
          </p>

          <p className="mt-1 text-xs font-semibold text-[#E9D8B9]">
            {source.dataset_name}
          </p>

          <p className="mt-1 text-[10px] text-[#777166]">
            {source.dataset_type === "synthetic"
              ? "Synthetic demonstration data"
              : "Uploaded dataset"}
          </p>
        </div>
      </div>

      <div
        className={`flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-[10px] font-semibold sm:self-auto ${
          compatible
            ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300"
            : "border-amber-500/20 bg-amber-500/[0.06] text-amber-300"
        }`}
      >
        {compatible ? (
          <ShieldCheck size={13} />
        ) : (
          <AlertTriangle size={13} />
        )}

        {compatible ? "WORKSPACE READY" : "WORKSPACE UNAVAILABLE"}
      </div>
    </div>
  );
}