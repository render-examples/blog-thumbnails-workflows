import { useEffect, useState } from "react";
import type { SubtaskInfo, TaskTimelineData } from "../types";
import { Spinner } from "./Spinner";

type Props = {
  data: TaskTimelineData;
};

const STATUS_PILL: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: "pending", bg: "bg-white/10", text: "text-white/50" },
  running: { label: "running", bg: "bg-yellow-400/15", text: "text-yellow-400" },
  completed: { label: "completed", bg: "bg-green-400/15", text: "text-green-400" },
  succeeded: { label: "completed", bg: "bg-green-400/15", text: "text-green-400" },
  failed: { label: "failed", bg: "bg-red-400/15", text: "text-red-400" },
  canceled: { label: "canceled", bg: "bg-orange-400/15", text: "text-orange-400" },
};

function StatusPill({ status }: { status: string }) {
  const pill = STATUS_PILL[status] ?? STATUS_PILL.pending;
  const isRunning = status === "running";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] ${pill.bg} ${pill.text}`}
    >
      {isRunning && (
        <span className="w-3 h-3 border border-yellow-400/40 border-t-yellow-400 rounded-full animate-spin" />
      )}
      {pill.label}
    </span>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return "--";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = (secs % 60).toFixed(0);
  return `${mins}m ${remainSecs}s`;
}

function useLiveDuration(startedAt: string | null, completedAt: string | null, status: string) {
  const [now, setNow] = useState(Date.now());
  const isRunning = status === "running";

  useEffect(() => {
    if (!isRunning || !startedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isRunning, startedAt]);

  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  if (completedAt) {
    return formatDuration(new Date(completedAt).getTime() - start);
  }
  if (isRunning) {
    return `${formatDuration(now - start)}...`;
  }
  return null;
}

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}

function subtaskLabel(subtask: SubtaskInfo): string {
  if (subtask.results?.model) return subtask.results.model;
  if (subtask.taskId) {
    const parts = subtask.taskId.split("/");
    return parts[parts.length - 1];
  }
  return "subtask";
}

function TimelineRow({
  label,
  id,
  status,
  startedAt,
  completedAt,
  isRoot,
  isLast,
}: {
  label: string;
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  isRoot?: boolean;
  isLast?: boolean;
}) {
  const duration = useLiveDuration(startedAt, completedAt, status);

  return (
    <div className="flex items-start gap-3 relative">
      {/* Connector */}
      <div className="flex flex-col items-center w-4 shrink-0">
        {isRoot ? (
          <div className="w-2.5 h-2.5 rounded-full border-2 border-white/40 mt-1" />
        ) : (
          <>
            <div className="w-px h-1 bg-white/20" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/30 mt-0" />
            {!isLast && <div className="w-px flex-1 bg-white/10 mt-0.5" />}
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={`text-xs font-mono ${isRoot ? "text-white/80" : "text-white/60"}`}
          >
            {label}
          </span>
          <span className="text-[10px] font-mono text-white/25">{truncateId(id)}</span>
          <StatusPill status={status} />
        </div>
        <div className="flex items-center gap-3 mt-1 text-[10px] text-white/30 font-mono">
          {startedAt && <span>started {formatTime(startedAt)}</span>}
          {duration && (
            <span className={status === "running" ? "text-yellow-400/60" : "text-white/40"}>
              {duration}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function TaskTimeline({ data }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const isTerminal =
    data.rootStatus === "completed" ||
    data.rootStatus === "succeeded" ||
    data.rootStatus === "failed" ||
    data.rootStatus === "canceled";

  return (
    <section className="mt-6 border border-white/10 bg-white/2">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/3 transition"
      >
        <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">
          Task Timeline
        </span>
        <div className="flex items-center gap-3">
          {!isTerminal && (
            <span className="w-3.5 h-3.5">
              <Spinner />
            </span>
          )}
          <span className="text-[10px] text-white/30 font-mono">
            {data.completedSubtasks}/{data.totalSubtasks} subtasks
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`text-white/30 transition-transform ${collapsed ? "" : "rotate-180"}`}
          >
            <title>Toggle</title>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 pt-1">
          <TimelineRow
            label={data.rootTaskName ?? "generateThumbnails"}
            id={data.rootTaskId}
            status={data.rootStatus}
            startedAt={data.rootStartedAt}
            completedAt={data.rootCompletedAt}
            isRoot
          />
          <div className="ml-2 border-l border-white/10 pl-1">
            {data.subtasks.map((subtask, i) => (
              <TimelineRow
                key={subtask.id}
                label={subtaskLabel(subtask)}
                id={subtask.id}
                status={subtask.status}
                startedAt={subtask.startedAt}
                completedAt={subtask.completedAt}
                isLast={i === data.subtasks.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
