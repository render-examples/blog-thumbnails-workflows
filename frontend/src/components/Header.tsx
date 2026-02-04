const demoMode = import.meta.env.VITE_DEMO_MODE === "true";

export function Header() {
  return (
    <header className="mb-8">
      <h1 className="text-2xl font-normal tracking-tight mb-2">BLOG THUMBNAIL GENERATOR</h1>
      <p className="text-neutral-500 text-sm">
        Generate AI thumbnails with multiple models using{" "}
        <a
          href="https://render.com/docs/workflows"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/80 hover:underline"
        >
          Render Workflows
        </a>
        . Images stored in MinIO.
      </p>
      {demoMode && (
        <p className="mt-2 text-xs text-yellow-400/80 border border-yellow-400/20 bg-yellow-400/5 px-3 py-2">
          This is a public demo instance with usage restrictions.{" "}
          <a
            href="https://github.com/render-examples/blog-thumbnails-workflow"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-yellow-300"
          >
            Deploy your own
          </a>{" "}
          for full access.
        </p>
      )}
    </header>
  );
}
