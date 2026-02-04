import { Dialog } from "@headlessui/react";
import { useState } from "react";
import type { GenerationResult } from "../types";

type Props = {
  results: GenerationResult[];
};

function ImageCard({ result }: { result: GenerationResult }) {
  const [isOpen, setIsOpen] = useState(false);
  const imageSrc = result.image_url;

  const handleDownload = async () => {
    try {
      // Fetch the image and create a blob URL for download
      const response = await fetch(imageSrc);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `thumbnail-${result.model}-${Date.now()}.jpg`;
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open in new tab
      window.open(imageSrc, "_blank");
    }
  };

  return (
    <>
      <div className="border border-white/15 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">{result.model}</p>
          <div className="flex gap-2">
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
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full cursor-pointer hover:opacity-90 transition"
        >
          <img src={imageSrc} alt={result.model} className="w-full" />
        </button>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/90" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="max-w-5xl w-full">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-xs uppercase tracking-[0.3em] text-white/60">
                {result.model}
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
            <img src={imageSrc} alt={result.model} className="w-full border border-white/20" />
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
}

export function ResultsGrid({ results }: Props) {
  // Filter out results without valid image URLs
  const validResults = results.filter((r) => r.image_url);

  if (validResults.length === 0) {
    return null;
  }

  return (
    <section className="mt-10 grid gap-6 md:grid-cols-2">
      {validResults.map((result) => (
        <ImageCard key={result.model} result={result} />
      ))}
    </section>
  );
}
