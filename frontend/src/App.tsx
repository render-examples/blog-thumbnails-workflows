import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import {
  Dropdown,
  FontDropdown,
  Gallery,
  Header,
  ModelSelector,
  ResultsGrid,
  Spinner,
  StatusIndicator,
  TemplateSelector,
  WorkflowPage,
} from "./components";
import { FONT_OPTIONS, MODEL_OPTIONS, STYLE_OPTIONS } from "./constants";
import type { Font, GenerationResult, Style, Template } from "./types";

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`text-xs uppercase tracking-[0.3em] transition ${
        isActive ? "text-white border-b-2 border-white pb-1" : "text-white/40 hover:text-white/60"
      }`}
    >
      {children}
    </Link>
  );
}

function useApiBase() {
  return useMemo(() => {
    const envHost = import.meta.env.VITE_API_HOST;
    if (envHost) {
      if (envHost.startsWith("http")) return envHost;
      if (envHost.includes(".onrender.com")) return `https://${envHost}`;
      return `https://${envHost}.onrender.com`;
    }
    return "http://localhost:8080";
  }, []);
}

function GeneratePage() {
  const apiBase = useApiBase();
  const [title, setTitle] = useState("");
  const [blogUrl, setBlogUrl] = useState("");
  const [extraPrompt, setExtraPrompt] = useState("");
  const [models, setModels] = useState([MODEL_OPTIONS[0].id]);
  const [style, setStyle] = useState<Style>("photorealistic");
  const [template, setTemplate] = useState<Template>("bottom-bar");
  const [font, setFont] = useState<Font>("inter");
  const [status, setStatus] = useState<string>("");
  const [taskId, setTaskId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [isFetchingTitle, setIsFetchingTitle] = useState(false);

  useEffect(() => {
    if (import.meta.env.MODE !== "production") {
      console.log("VITE_API_HOST", import.meta.env.VITE_API_HOST);
      console.log("apiBase", apiBase);
    }
  }, [apiBase]);

  useEffect(() => {
    if (!blogUrl || !blogUrl.match(/^https?:\/\/.+\..+/)) {
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setIsFetchingTitle(true);
        const response = await fetch(`${apiBase}/api/metadata?url=${encodeURIComponent(blogUrl)}`);
        const data = await response.json();
        if (data?.title) {
          setTitle(data.title);
        }
      } catch {
        // Ignore metadata errors
      } finally {
        setIsFetchingTitle(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [apiBase, blogUrl, title]);

  const submit = async () => {
    setStatus("starting");
    setResults([]);
    setErrorMessage("");
    try {
      const response = await fetch(`${apiBase}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          models,
          style,
          template,
          font,
          blogUrl: blogUrl || undefined,
          extraPrompt: extraPrompt || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus("error");
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const mins = retryAfter ? Math.ceil(Number(retryAfter) / 60) : null;
          setErrorMessage(
            mins
              ? `Rate limit reached — try again in ${mins} minute${mins > 1 ? "s" : ""}`
              : "Rate limit reached — please try again later",
          );
          return;
        }
        setErrorMessage(data.detail || data.error || `HTTP ${response.status}`);
        return;
      }
      // API returns: { task_id, status, results: { title, results: [...], failures } }
      const images = data.results?.results as GenerationResult[] | undefined;
      if (images && images.length > 0) {
        setTaskId(data.task_id || "");
        setStatus("completed");
        setResults(images);
        return;
      }
      setStatus("error");
      setErrorMessage("No results returned");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Network error");
    }
  };

  return (
    <>
      <section className="grid gap-6 md:grid-cols-3">
        <ModelSelector options={MODEL_OPTIONS} selected={models} onChange={setModels} />
        <Dropdown
          label="Style"
          value={style}
          options={STYLE_OPTIONS}
          onChange={(value) => setStyle(value as Style)}
        />
        <FontDropdown
          value={font}
          options={FONT_OPTIONS}
          onChange={(value) => setFont(value as Font)}
        />
      </section>

      <section className="mt-8">
        <TemplateSelector value={template} onChange={setTemplate} />
      </section>

      <section className="mt-8 grid gap-6">
        <div className="border border-white/15 p-5">
          <label
            htmlFor="blog-url"
            className="block text-xs uppercase tracking-[0.3em] text-white/60"
          >
            Blog URL (optional)
          </label>
          <div className="mt-3 relative">
            <input
              id="blog-url"
              value={blogUrl}
              onChange={(event) => setBlogUrl(event.target.value)}
              className="w-full bg-black border border-white/20 p-3 pr-12 text-white focus:outline-none"
              placeholder="https://example.com/blog/post"
            />
            {isFetchingTitle && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Spinner />
              </div>
            )}
          </div>
        </div>
        <div className="border border-white/15 p-5">
          <label
            htmlFor="blog-title"
            className="block text-xs uppercase tracking-[0.3em] text-white/60"
          >
            Blog Title
          </label>
          <input
            id="blog-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-3 w-full bg-black border border-white/20 p-3 text-white focus:outline-none"
            placeholder="e.g., Shipping 1,000 workflows per minute"
          />
        </div>
        <div className="border border-white/15 p-5">
          <label
            htmlFor="extra-prompt"
            className="block text-xs uppercase tracking-[0.3em] text-white/60"
          >
            Extra Prompt (optional)
          </label>
          <textarea
            id="extra-prompt"
            value={extraPrompt}
            onChange={(event) => setExtraPrompt(event.target.value)}
            className="mt-3 w-full bg-black border border-white/20 p-3 text-white min-h-[120px] focus:outline-none"
            placeholder="Add optional creative direction."
          />
        </div>
      </section>

      <section className="mt-8 flex items-center gap-6">
        <button
          type="button"
          onClick={submit}
          className="h-[50px] px-6 border border-white bg-white text-black uppercase tracking-[0.3em] cursor-pointer hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!title || status === "starting" || status === "running"}
        >
          Generate
        </button>
        <StatusIndicator status={status} taskId={taskId} errorMessage={errorMessage} />
      </section>

      <ResultsGrid results={results} />
    </>
  );
}

function GalleryPage() {
  const apiBase = useApiBase();
  return <Gallery apiBase={apiBase} />;
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <Header />
        <nav className="flex gap-8 mb-10 border-b border-white/10 pb-4">
          <NavLink to="/">Generate</NavLink>
          <NavLink to="/gallery">Gallery</NavLink>
          <NavLink to="/how-it-works">How It Works</NavLink>
        </nav>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<GeneratePage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/how-it-works" element={<WorkflowPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
