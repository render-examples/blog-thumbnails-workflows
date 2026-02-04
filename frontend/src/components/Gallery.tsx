import { Dialog } from "@headlessui/react";
import { useEffect, useState } from "react";
import { Spinner } from "./Spinner";

const demoMode = import.meta.env.VITE_DEMO_MODE === "true";

type GalleryImage = {
  key: string;
  url: string;
  lastModified?: string;
  size?: number;
};

type Props = {
  apiBase: string;
};

function ImageCard({
  image,
  onDelete,
  isSelected,
  onSelect,
  selectionMode,
}: {
  image: GalleryImage;
  onDelete: (key: string) => void;
  isSelected: boolean;
  onSelect: (key: string, selected: boolean) => void;
  selectionMode: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDownload = async () => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = image.key.split("/").pop() || "thumbnail.jpg";
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(image.url, "_blank");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this image?")) return;
    setIsDeleting(true);
    onDelete(image.key);
  };

  // Extract model name from key (e.g., "photorealistic/gemini_20240101_123456_abc.jpg")
  const fileName = image.key.split("/").pop() || image.key;
  const modelMatch = fileName.match(/^([^_]+)/);
  const modelName = modelMatch ? modelMatch[1].replace(/_/g, "-") : "unknown";

  // Format date
  const dateStr = image.lastModified
    ? new Date(image.lastModified).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <>
      <div
        className={`border p-4 group relative ${isSelected ? "border-white/60 bg-white/5" : "border-white/15"}`}
      >
        {/* Selection checkbox */}
        {selectionMode && (
          <div className="absolute top-2 left-2 z-10">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelect(image.key, e.target.checked)}
              className="w-5 h-5 cursor-pointer accent-white"
            />
          </div>
        )}
        <div className="flex items-center justify-between mb-3">
          <div className={selectionMode ? "ml-7" : ""}>
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">{modelName}</p>
            {dateStr && <p className="text-xs text-white/40 mt-1">{dateStr}</p>}
          </div>
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="p-1 text-white/40 hover:text-white transition cursor-pointer"
              title="View full size"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <title>Expand</title>
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="p-1 text-white/40 hover:text-white transition cursor-pointer"
              title="Download"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <title>Download</title>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
            </button>
            {!demoMode && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1 text-white/40 hover:text-red-400 transition cursor-pointer disabled:opacity-50"
                title="Delete"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <title>Delete</title>
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full cursor-pointer hover:opacity-90 transition"
        >
          <img src={image.url} alt={modelName} className="w-full" loading="lazy" />
        </button>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/90" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="max-w-5xl w-full">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-xs uppercase tracking-[0.3em] text-white/60">
                {modelName}
              </Dialog.Title>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="text-sm text-white/60 hover:text-white transition cursor-pointer"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-sm text-white/60 hover:text-white transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
            <img src={image.url} alt={modelName} className="w-full border border-white/20" />
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
}

export function Gallery({ apiBase }: Props) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSelect = (key: string, selected: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedKeys.size === images.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(images.map((img) => img.key)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedKeys.size === 0) return;
    if (!confirm(`Delete ${selectedKeys.size} image${selectedKeys.size > 1 ? "s" : ""}?`)) return;

    setIsDeleting(true);
    const keysToDelete = Array.from(selectedKeys);

    for (const key of keysToDelete) {
      try {
        await fetch(`${apiBase}/api/gallery?key=${encodeURIComponent(key)}`, {
          method: "DELETE",
        });
      } catch {
        // Continue with other deletions
      }
    }

    setImages((prev) => prev.filter((img) => !selectedKeys.has(img.key)));
    setSelectedKeys(new Set());
    setSelectionMode(false);
    setIsDeleting(false);
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedKeys(new Set());
  };

  const fetchImages = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/gallery`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setImages(data.images || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load gallery");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [apiBase]);

  const handleDelete = async (key: string) => {
    try {
      const response = await fetch(`${apiBase}/api/gallery?key=${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setImages((prev) => prev.filter((img) => img.key !== key));
      }
    } catch {
      // Ignore delete errors
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
        <span className="ml-3 text-white/60">Loading gallery...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400">{error}</p>
        <button
          type="button"
          onClick={fetchImages}
          className="mt-4 px-4 py-2 border border-white/30 text-white/60 hover:text-white hover:border-white/60 transition cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="text-center py-20 text-white/40">
        <p>No images generated yet.</p>
        <p className="text-sm mt-2">Generate some thumbnails to see them here.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">
            {images.length} image{images.length !== 1 ? "s" : ""}
          </p>
          {selectionMode && selectedKeys.size > 0 && (
            <p className="text-xs text-white/40">{selectedKeys.size} selected</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          {demoMode ? (
            <button
              type="button"
              onClick={fetchImages}
              className="text-xs text-white/40 hover:text-white transition cursor-pointer"
            >
              Refresh
            </button>
          ) : selectionMode ? (
            <>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-white/40 hover:text-white transition cursor-pointer"
              >
                {selectedKeys.size === images.length ? "Deselect All" : "Select All"}
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={selectedKeys.size === 0 || isDeleting}
                className="text-xs text-red-400 hover:text-red-300 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting..." : `Delete (${selectedKeys.size})`}
              </button>
              <button
                type="button"
                onClick={cancelSelection}
                className="text-xs text-white/40 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSelectionMode(true)}
                className="text-xs text-white/40 hover:text-white transition cursor-pointer"
              >
                Select
              </button>
              <button
                type="button"
                onClick={fetchImages}
                className="text-xs text-white/40 hover:text-white transition cursor-pointer"
              >
                Refresh
              </button>
            </>
          )}
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {images.map((image) => (
          <ImageCard
            key={image.key}
            image={image}
            onDelete={handleDelete}
            isSelected={selectedKeys.has(image.key)}
            onSelect={handleSelect}
            selectionMode={selectionMode}
          />
        ))}
      </div>
    </div>
  );
}
