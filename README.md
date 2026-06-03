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
| GPT-Image-2 | OpenAI |

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
   git clone https://github.com/render-examples/blog-thumbnails-workflows.git
   cd blog-thumbnails-workflows
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

Deployment happens in two parts:

1. The web app (frontend, API, and MinIO) deploys from the included [Blueprint](https://render.com/docs/infrastructure-as-code).
2. The workflow service deploys separately through the Dashboard, because [Render Workflows](https://render.com/docs/workflows) don't support Blueprints yet.

Do them in order. The workflow service needs to exist before the API can call it, and the API needs the workflow's slug to route runs.

### 1. Deploy the web app (Blueprint)

1. [Use this template](https://github.com/render-examples/blog-thumbnails-workflows/generate) on GitHub to create your own copy of the repo.
2. Deploy to Render with the included Blueprint:

   [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

This creates a **static site** for the frontend, a **web service** for the API (TypeScript by default), and a **MinIO** web service for image storage. The Blueprint wires the MinIO credentials into the API automatically. You'll fill in `RENDER_API_KEY` and `WORKFLOW_SLUG` after step 2, since both depend on the workflow service.

### 2. Deploy the workflow service (Dashboard)

The workflow service runs the task definitions in `typescript/workflow-ts` or `python/workflow-python`. Create it by hand in the Dashboard:

1. Push your copy of the repo to GitHub, GitLab, or Bitbucket.
2. In the [Render Dashboard](https://dashboard.render.com), click **New > Workflow**.
3. Connect your repository.
4. Set the **Language**, **Root Directory**, **Build Command**, and **Start Command** for the implementation you want:

   | Field | TypeScript | Python |
   |---|---|---|
   | **Language** | Node | Python 3 |
   | **Root Directory** | `typescript/workflow-ts` | `python/workflow-python` |
   | **Build Command** | `npm install && npm run build` | `pip install -r requirements.txt` |
   | **Start Command** | `npm run start` | `python main.py` |
   | **Instance Type** | `standard` or higher recommended | `standard` or higher recommended |

   Pick **one** implementation. The frontend and API work with either, but the workflow's slug must match `WORKFLOW_SLUG` on the API (step 3).

5. Add the environment variables the tasks need (see the [workflow service table](#workflow-service) below). The image keys and MinIO credentials must be set here too, because the Blueprint doesn't manage this service. Copy the MinIO values from the `minio-server` service created in step 1:

   | Workflow variable | Copy from `minio-server` |
   |---|---|
   | `MINIO_ENDPOINT` | the service's external URL (shown at the top of its page) |
   | `MINIO_ACCESS_KEY` | its `MINIO_ROOT_USER` env var |
   | `MINIO_SECRET_KEY` | its `MINIO_ROOT_PASSWORD` env var |
   | `MINIO_PUBLIC_BASE_URL` | the same external URL as `MINIO_ENDPOINT` |

6. Click **Deploy Workflow** and wait for a successful deploy event.
7. Note the workflow's **slug** (for example, `blog-thumb-workflow-ts`). It appears in the service URL and on each task's page. You'll need it in step 3. Tasks are addressed as `{workflow-slug}/generateThumbnails`.

### 3. Connect the API to the workflow

Back on your **API service**, set the two values left blank by the Blueprint, then trigger a manual deploy:

| Variable | Value |
|---|---|
| `WORKFLOW_SLUG` | the workflow slug from step 2.7 (for example, `blog-thumb-workflow-ts`) |
| `RENDER_API_KEY` | a [Render API key](https://render.com/docs/api#1-create-an-api-key) with access to your workspace |

The API uses `RENDER_API_KEY` to authenticate and `WORKFLOW_SLUG` to build the task identifier (`{WORKFLOW_SLUG}/generateThumbnails`) it calls through the SDK.

### Environment variables

#### API service

The Blueprint sets the MinIO variables automatically. The rest you set yourself.

| Variable | Description | Set by |
|---|---|---|
| `RENDER_API_KEY` | [Render API key](https://render.com/docs/api#1-create-an-api-key) for triggering workflow runs | You (step 3) |
| `WORKFLOW_SLUG` | Slug of your deployed workflow service (for example, `blog-thumb-workflow-ts`) | You (step 3) |
| `OPENAI_API_KEY` | OpenAI key, used for content moderation when enabled | You |
| `GOOGLE_API_KEY` | Google AI key | You |
| `ENABLE_MODERATION` | Set to `true` to enable content moderation via OpenAI (default: disabled) | You (optional) |
| `MINIO_ENDPOINT` | MinIO server URL | Blueprint |
| `MINIO_ACCESS_KEY` | MinIO access key | Blueprint |
| `MINIO_SECRET_KEY` | MinIO secret key | Blueprint |
| `MINIO_BUCKET` | Bucket name (default: `thumbnails`) | Blueprint |
| `MINIO_PUBLIC_BASE_URL` | Public base URL for serving images | Blueprint |

#### Workflow service

Set all of these yourself in the Dashboard. The MinIO values come from the `minio-server` service (see step 2.5).

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI key, used for image generation with GPT Image models |
| `GOOGLE_API_KEY` | Google AI key, used for Gemini image generation |
| `MINIO_ENDPOINT` | MinIO server URL |
| `MINIO_ACCESS_KEY` | MinIO access key |
| `MINIO_SECRET_KEY` | MinIO secret key |
| `MINIO_BUCKET` | Bucket name (default: `thumbnails`) |
| `MINIO_PUBLIC_BASE_URL` | Public base URL for serving images |

### Troubleshooting

Most deploy problems come from the two services not being wired together, or from the workflow service missing a key. Check the failing service's logs in the Dashboard first, then work through the table.

| Symptom | Likely cause | Fix |
|---|---|---|
| API returns `WORKFLOW_SLUG not configured` | `WORKFLOW_SLUG` is unset on the API | Set it to the workflow service's slug (step 3), then redeploy the API |
| API returns 401 or `Unauthorized` when generating | Missing or wrong `RENDER_API_KEY` | Set a valid [Render API key](https://render.com/docs/api#1-create-an-api-key) that belongs to the same workspace as the workflow, then redeploy |
| Run fails with "task not found" | `WORKFLOW_SLUG` doesn't match the deployed workflow, or the task didn't register | Confirm the slug matches exactly, and that the deploy logs show `generateThumbnails` and `generateThumbnail` registering on startup |
| Workflow task fails with `MinIO credentials not configured` | MinIO env vars aren't set on the workflow service | The Blueprint only wires MinIO into the API. Copy the values onto the workflow service too (see step 2.5) |
| Generated images don't load in the gallery | `MINIO_PUBLIC_BASE_URL` missing or wrong | Set it on both the API and workflow service to the `minio-server` external URL |
| Task fails with `The model '...' does not exist` | The selected model was deprecated or your OpenAI org lacks access | Use a supported model from `shared/models.json`. Check availability on the [OpenAI models page](https://platform.openai.com/docs/models) |
| Workflow build fails | Wrong root directory or build command | TypeScript: root `typescript/workflow-ts`, build `npm install && npm run build`. Python: root `python/workflow-python`, build `pip install -r requirements.txt` |
| Workflow deploys but exits on start | Wrong start command | TypeScript: `npm run start`. Python: `python main.py` |
| Runs stay `pending` for a long time | Workspace hit its concurrent-run limit | Wait for in-progress runs to finish, cancel stuck runs, or add concurrency. Extra workflow services don't raise the limit |

For deeper Workflows debugging, see the [Render Workflows docs](https://render.com/docs/workflows).

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
