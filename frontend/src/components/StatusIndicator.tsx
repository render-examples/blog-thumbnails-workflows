import { useEffect, useState } from "react";
import { Spinner } from "./Spinner";

type Status = "" | "starting" | "running" | "completed" | "failed" | "error" | "timeout";

type Props = {
  status: Status | string;
  taskId?: string;
  errorMessage?: string;
};

const PROGRESS_MESSAGES = [
  "Initializing...",
  "Building prompt...",
  "Generating image...",
  "Processing with AI...",
  "Applying style...",
  "Rendering overlay...",
  "Compositing layers...",
  "Almost there...",
];

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon?: string; showSpinner?: boolean }
> = {
  "": { label: "Ready", color: "text-white/40" },
  idle: { label: "Ready", color: "text-white/40" },
  starting: { label: "Starting", color: "text-yellow-400", showSpinner: true },
  running: { label: "Generating", color: "text-yellow-400", showSpinner: true },
  completed: { label: "Completed", color: "text-green-400", icon: "✓" },
  failed: { label: "Failed", color: "text-red-400", icon: "✕" },
  error: { label: "Error", color: "text-red-400", icon: "✕" },
  timeout: { label: "Timeout", color: "text-orange-400", icon: "⏱" },
};

export function StatusIndicator({ status, taskId, errorMessage }: Props) {
  const [messageIndex, setMessageIndex] = useState(0);
  const config =
    STATUS_CONFIG[status] ||
    (status.startsWith("running") ? STATUS_CONFIG["running"] : STATUS_CONFIG[""]);
  const isActive = status === "starting" || status === "running" || status.startsWith("running (");
  const isError = status === "error" || status === "failed" || status === "timeout";

  useEffect(() => {
    if (!isActive) {
      setMessageIndex(0);
      return;
    }
    let timeout: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      const delay = 1500 + Math.random() * 2000; // 1.5s to 3.5s
      timeout = setTimeout(() => {
        setMessageIndex((i) => (i + 1) % PROGRESS_MESSAGES.length);
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => clearTimeout(timeout);
  }, [isActive]);

  // Show progress count if available (e.g., "running (2/3)")
  const progressMatch = status.match(/running \((\d+)\/(\d+)\)/);
  const progressLabel = progressMatch
    ? `${PROGRESS_MESSAGES[messageIndex]} (${progressMatch[1]}/${progressMatch[2]})`
    : PROGRESS_MESSAGES[messageIndex];
  const displayLabel = isActive ? progressLabel : config.label;

  return (
    <div
      className={`h-[50px] flex items-center gap-3 px-4 border ${
        isActive
          ? "border-yellow-400/30 bg-yellow-400/5"
          : isError
            ? "border-red-400/30 bg-red-400/5"
            : "border-white/10"
      }`}
    >
      {config.showSpinner ? (
        <Spinner />
      ) : config.icon ? (
        <span className={config.color}>{config.icon}</span>
      ) : (
        <span className="w-2 h-2 bg-white/20" />
      )}
      <span className={`text-sm ${config.color}`}>{displayLabel}</span>
      {taskId && isActive && <span className="text-xs text-white/30 font-mono">{taskId}</span>}
      {errorMessage && isError && (
        <span className="text-xs text-white/50 max-w-xs truncate">{errorMessage}</span>
      )}
    </div>
  );
}
