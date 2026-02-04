# Blog Thumbnail Generator with Render Workflows

Generate AI-powered blog thumbnails using multiple image models in parallel, orchestrated by [Render Workflows](https://render.com/docs/workflows). Each model runs as an isolated task with its own compute, retry logic, and timeout — all managed by the Render platform.

The app includes a React frontend, an API server (available in both TypeScript and Python), and workflow task definitions that run on Render Workflows.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────────────┐
│   Frontend   │────▶│   API       │────▶│   Render Workflows       │
│   (React)    │     │  (Express / │     │                          │
│              │◀────│   FastAPI)  │◀────│  generateThumbnails      │
└─────────────┘     └─────────────┘     │    ├─ generateThumbnail  │
                           │            │    ├─ generateThumbnail  │
                           │            │    └─ generateThumbnail  │
                    ┌──────▼──────┐     └──────────────────────────┘
                    │    MinIO    │               │
                    │  (storage)  │◀──────────────┘
                    └─────────────┘
```

1. The **frontend** collects a blog title, style, template, font, and model selection from the user.
2. The **API** validates the input, runs content moderation, and triggers a workflow run via the Render SDK.
3. **Render Workflows** spins up a parent task (`generateThumbnails`) that fans out one subtask (`generateThumbnail`) per selected model — each running in its own compute instance.
4. Each subtask calls an AI image API (OpenAI or Google Gemini), resizes the result, composites a text overlay, and uploads the final JPEG to **MinIO**.
5. Results flow back through the API to the frontend, which displays the generated thumbnails.

## Supported models

| Model | Provider |
|---|---|
| Gemini 3 Pro Preview | Google |
| GPT-Image-1 | OpenAI |
| DALL-E 3 | OpenAI |

## Project structure

```
├── frontend/                  # React + Vite + Tailwind
├── typescript/
│   ├── api-ts/                # Express API server
│   └── workflow-ts/           # Render Workflow task definitions
├── python/
│   ├── api-python/            # FastAPI API server
│   └── workflow-python/       # Render Workflow task definitions
├── shared/                    # Shared config (models, styles, fonts, templates)
├── docker/                    # Dockerfiles for local dev
├── docker-compose.yml         # Local dev orchestration
└── render.yaml                # Render Blueprint for deployment
```

Both the TypeScript and Python implementations are functionally equivalent. Choose whichever you prefer — the frontend works with either API.

## Quick start (local development)

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- An [OpenAI API key](https://platform.openai.com/api-keys) and/or a [Google AI API key](https://aistudio.google.com/apikey)

### Setup

1. Clone the repository:

   ```sh
   git clone https://github.com/render-examples/blog-thumbnails-workflow.git
   cd blog-thumbnails-workflow
   ```

2. Create your environment file:

   ```sh
   cp env.local.example .env.local
   ```

3. Edit `.env.local` and add your API keys:

   ```
   OPENAI_API_KEY=sk-...
   GOOGLE_API_KEY=AI...
   ```

4. Start the stack with Docker Compose:

   ```sh
   # TypeScript API (default)
   docker compose up

   # Or use the Python API instead
   docker compose --profile python up
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser.

In local mode (`LOCAL_MODE=true`), the API runs image generation directly (bypassing Render Workflows) so you can develop without a Render account. To test the full workflow orchestration locally, see below.

### Testing with the local workflow server

To run the actual Render Workflows task server locally (fan-out, retries, subtasks), use the [Render CLI](https://render.com/docs/cli) (v2.11.0+):

1. Install the CLI:

   ```sh
   # macOS
   brew install render

   # Linux / macOS
   curl -fsSL https://raw.githubusercontent.com/render-oss/cli/main/bin/install.sh | sh
   ```

2. Start the local workflow server:

   ```sh
   # TypeScript
   render workflows dev -- npx tsx typescript/workflow-ts/src/index.ts

   # Python
   render workflows dev -- python python/workflow-python/main.py
   ```

   The server starts on port 8120 and picks up code changes automatically.

3. Configure the API to use the local workflow server by adding to `.env.local`:

   ```
   RENDER_USE_LOCAL_DEV=true
   ```

   Then remove `LOCAL_MODE=true` from `docker-compose.yml` (or your env) so the API triggers tasks through the workflow server instead of running generation inline.

4. Verify tasks are registered:

   ```sh
   render workflows list --local
   ```

5. You can also run tasks directly from the CLI:

   ```sh
   render workflows list --local
   # Select a task, choose "run", and provide input as JSON (e.g., ["My Blog Title", ["gemini-3-pro-image-preview"], "photorealistic", "bottom-bar", "inter", "", ""])
   ```

### Running without Docker

If you prefer running services individually:

**MinIO:**

```sh
# Start MinIO however you prefer, or use the Docker container alone
docker compose up minio minio-init
```

**TypeScript API:**

```sh
cd typescript/api-ts
npm install
npm run dev
```

**Python API:**

```sh
cd python/api-python
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**

```sh
cd frontend
npm install
npm run dev
```

## Deploy to Render

1. [Use this template](https://github.com/render-examples/blog-thumbnails-workflow/generate) on GitHub to create your own copy of the repo.
2. Then deploy to Render with the included [Blueprint](https://render.com/docs/infrastructure-as-code):

   [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

This creates:

- A **static site** for the frontend
- A **web service** for the API (TypeScript by default)
- A **MinIO** instance for image storage

The workflow services (`workflow-ts` or `workflow-python`) are deployed separately through [Render Workflows](https://render.com/docs/workflows) in the Dashboard.

### Required environment variables

Set these on your API service (via the Render Dashboard or `render.yaml`):

| Variable | Description |
|---|---|
| `RENDER_API_KEY` | Your [Render API key](https://render.com/docs/api#1-create-an-api-key) for triggering workflow runs |
| `WORKFLOW_SLUG` | The slug of your deployed workflow (e.g., `blog-thumb-workflow-ts`) |
| `OPENAI_API_KEY` | OpenAI key (for image generation, and for content moderation if enabled) |
| `GOOGLE_API_KEY` | Google AI key (for Gemini image generation) |
| `ENABLE_MODERATION` | Set to `true` to enable content moderation via OpenAI (default: disabled) |

Set these on your workflow service:

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI key (for image generation) |
| `GOOGLE_API_KEY` | Google AI key (for Gemini image generation) |
| `MINIO_ENDPOINT` | MinIO server URL |
| `MINIO_ACCESS_KEY` | MinIO access key |
| `MINIO_SECRET_KEY` | MinIO secret key |
| `MINIO_BUCKET` | Bucket name (default: `thumbnails`) |

## Features

### Image generation

- **Multiple models in parallel**: Select one or more AI models and generate thumbnails simultaneously, each running as an independent workflow task.
- **12 visual styles**: Photorealistic, cinematic, cartoon, anime, 3D render, pixel art, watercolor, oil painting, sketch, minimalist, neon, and vintage.
- **5 overlay templates**: Bottom bar, left panel, center box, overlay bottom, and overlay center — each compositing the blog title onto the generated image.
- **Font selection**: Multiple font options rendered via SVG overlay (TypeScript) or Pillow (Python).

### Workflow orchestration

- **Fan-out pattern**: The parent task spawns one subtask per model. Each subtask runs in isolated compute with its own resources.
- **Automatic retries**: Subtasks retry up to 2 times with exponential backoff (5s base, 2x scaling).
- **Run chaining**: Subtasks are triggered by calling the wrapped task function from within the parent task.

### Safety and rate limiting

- **Content moderation** (opt-in): Set `ENABLE_MODERATION=true` on the API service to check prompts against the [OpenAI Moderation API](https://platform.openai.com/docs/guides/moderation) before image generation. Flagged content is rejected with a clear message. Requires `OPENAI_API_KEY` to be set. Disabled by default.
- **Rate limiting**: The generate endpoint is rate-limited (10 requests/minute by default). In demo mode (`DEMO_MODE=true`), this tightens to 2 requests/hour.
- **Input validation**: Title length, model count, style/template/font values, and extra prompt length are all validated server-side.

### Gallery

- **Persistent storage**: Generated images are uploaded to MinIO (S3-compatible) and accessible via the Gallery page.
- **Bulk management**: Select, delete, and download images from the gallery.

## Shared configuration

Model definitions, styles, templates, fonts, and canvas dimensions live in `shared/` as JSON files. Both the TypeScript and Python implementations read from these files, keeping configuration in sync.

## Linting

```sh
# TypeScript (Biome)
cd typescript/api-ts && npm run check
cd typescript/workflow-ts && npm run check

# Python (Ruff)
ruff check --fix python/ && ruff format python/
```

## License

This project is provided as a Render example. See [LICENSE](LICENSE) for details.
