"use client";

import { type WorkflowConfig, WorkflowVisualizer } from "workflow-visualizer";

const workflowConfig: WorkflowConfig = {
  title: "Blog Thumbnail Generator",
  subtitle: "How the workflow creates AI-powered thumbnails",
  nodes: [
    {
      id: "ui-trigger",
      label: "Generate Button",
      type: "trigger",
      description:
        "User fills in the blog title, selects AI models, style, template, and font, then clicks Generate to start the workflow.",
      position: { x: 350, y: 50 },
      details: [
        { label: "Input", value: "Title, models, style, template, font" },
        { label: "Optional", value: "Blog URL, extra prompt" },
      ],
    },
    {
      id: "api-service",
      label: "API Service",
      type: "task",
      description:
        "Validates the request, applies rate limiting, and optionally fetches blog context if a URL was provided.",
      position: { x: 350, y: 180 },
      details: [
        { label: "Rate Limit", value: "10 requests/min per IP" },
        { label: "Validation", value: "Schema validation on all inputs" },
      ],
    },
    {
      id: "blog-scraper",
      label: "Blog Scraper",
      type: "task",
      description:
        "Fetches the blog URL, extracts text content, and retrieves the title. This context enhances the AI prompt.",
      position: { x: 150, y: 320 },
      details: [
        { label: "Timeout", value: "10 seconds" },
        { label: "Max Context", value: "2500 characters" },
      ],
    },
    {
      id: "orchestrator",
      label: "generateThumbnails",
      type: "orchestrator",
      description:
        "Render Workflows orchestrator that spawns parallel subtasks for each selected AI model. Uses distributed execution for scalability.",
      position: { x: 350, y: 320 },
      details: [
        { label: "Retries", value: "2 max with exponential backoff" },
        { label: "Execution", value: "Parallel across compute instances" },
      ],
    },
    {
      id: "thumbnail-tasks",
      label: "generateThumbnail",
      type: "batch",
      description:
        "Individual subtask for each AI model. Runs in parallel - one task per model selected by the user.",
      position: { x: 350, y: 460 },
      details: [
        { label: "Parallelism", value: "One task per model" },
        { label: "Isolation", value: "Each task runs independently" },
      ],
    },
    {
      id: "ai-generation",
      label: "AI Image Generation",
      type: "task",
      description:
        "Calls the AI provider (OpenAI or Google Gemini) to generate an image based on the style and title. The prompt is built from style description, title, and optional context.",
      position: { x: 150, y: 600 },
      details: [
        { label: "OpenAI", value: "DALL-E 2, DALL-E 3, GPT Image" },
        { label: "Google", value: "Gemini 3 Pro Image Preview" },
      ],
    },
    {
      id: "image-processing",
      label: "Image Processing",
      type: "task",
      description:
        "Resizes the AI-generated image to 1920x1080, applies the selected template overlay with the blog title text, and composites the final image.",
      position: { x: 350, y: 600 },
      details: [
        { label: "Canvas", value: "1920x1080 pixels" },
        {
          label: "Templates",
          value: "bottom-bar, left-panel, center-box, overlay",
        },
      ],
    },
    {
      id: "storage-upload",
      label: "Storage Upload",
      type: "task",
      description:
        "Uploads the final JPEG image to MinIO/S3 object storage with public read access. Returns the public URL for display.",
      position: { x: 550, y: 600 },
      details: [
        { label: "Format", value: "JPEG @ 85% quality" },
        { label: "Access", value: "Public read" },
      ],
    },
    {
      id: "results",
      label: "Aggregate Results",
      type: "task",
      description:
        "Collects all thumbnail URLs from parallel tasks, reports any failures, and returns the combined results to the API.",
      position: { x: 350, y: 740 },
      details: [
        { label: "Success", value: "Array of image URLs" },
        { label: "Failures", value: "Error messages per model" },
      ],
    },
  ],
  edges: [
    { id: "ui-api", from: "ui-trigger", to: "api-service", style: "solid" },
    {
      id: "api-scraper",
      from: "api-service",
      to: "blog-scraper",
      label: "if URL",
      style: "dashed",
    },
    {
      id: "api-orchestrator",
      from: "api-service",
      to: "orchestrator",
      style: "solid",
    },
    {
      id: "orchestrator-tasks",
      from: "orchestrator",
      to: "thumbnail-tasks",
      label: "spawns",
      style: "solid",
    },
    {
      id: "tasks-ai",
      from: "thumbnail-tasks",
      to: "ai-generation",
      style: "solid",
    },
    {
      id: "ai-processing",
      from: "ai-generation",
      to: "image-processing",
      style: "solid",
    },
    {
      id: "processing-storage",
      from: "image-processing",
      to: "storage-upload",
      style: "solid",
    },
    {
      id: "storage-results",
      from: "storage-upload",
      to: "results",
      style: "solid",
    },
    {
      id: "results-ui",
      from: "results",
      to: "ui-trigger",
      label: "response",
      style: "dashed",
    },
  ],
  defaultTrigger: "ui-trigger",
  triggerFlows: [
    {
      triggerId: "ui-trigger",
      nodes: [
        "ui-trigger",
        "api-service",
        "blog-scraper",
        "orchestrator",
        "thumbnail-tasks",
        "ai-generation",
        "image-processing",
        "storage-upload",
        "results",
      ],
      edges: [
        "ui-api",
        "api-scraper",
        "api-orchestrator",
        "orchestrator-tasks",
        "tasks-ai",
        "ai-processing",
        "processing-storage",
        "storage-results",
        "results-ui",
      ],
      animationSequence: [
        {
          id: "step1",
          activeNodes: ["ui-trigger"],
          activeEdges: [],
          duration: 4000,
          title: "User Initiates Generation",
          description:
            "User enters a blog title, selects AI models (OpenAI or Gemini), picks a style, template, and font, then clicks Generate.",
        },
        {
          id: "step2",
          activeNodes: ["ui-trigger", "api-service"],
          activeEdges: ["ui-api"],
          duration: 4000,
          title: "API Receives Request",
          description:
            "The API service validates the request, checks rate limits, and prepares to invoke the workflow.",
        },
        {
          id: "step3",
          activeNodes: ["api-service", "blog-scraper"],
          activeEdges: ["api-scraper"],
          duration: 4000,
          title: "Optional: Fetch Blog Context",
          description:
            "If a blog URL was provided, the API fetches the page and extracts text content to enhance the AI prompt.",
        },
        {
          id: "step4",
          activeNodes: ["api-service", "orchestrator"],
          activeEdges: ["api-orchestrator"],
          duration: 4000,
          title: "Invoke Render Workflows",
          description:
            "The API calls Render Workflows to start the generateThumbnails task, which will orchestrate the parallel generation.",
        },
        {
          id: "step5",
          activeNodes: ["orchestrator", "thumbnail-tasks"],
          activeEdges: ["orchestrator-tasks"],
          duration: 4000,
          title: "Spawn Parallel Tasks",
          description:
            "The orchestrator spawns one generateThumbnail subtask for each selected AI model. All tasks run in parallel.",
        },
        {
          id: "step6",
          activeNodes: ["thumbnail-tasks", "ai-generation"],
          activeEdges: ["tasks-ai"],
          duration: 4000,
          title: "AI Image Generation",
          description:
            "Each subtask builds a prompt from the style and title, then calls the AI provider (OpenAI or Gemini) to generate an image.",
        },
        {
          id: "step7",
          activeNodes: ["ai-generation", "image-processing"],
          activeEdges: ["ai-processing"],
          duration: 4000,
          title: "Process & Overlay",
          description:
            "The generated image is resized to 1920x1080, and the selected template overlay with the blog title is composited on top.",
        },
        {
          id: "step8",
          activeNodes: ["image-processing", "storage-upload"],
          activeEdges: ["processing-storage"],
          duration: 4000,
          title: "Upload to Storage",
          description:
            "The final JPEG is uploaded to MinIO/S3 with public read access. A unique URL is generated for each thumbnail.",
        },
        {
          id: "step9",
          activeNodes: ["storage-upload", "results"],
          activeEdges: ["storage-results"],
          duration: 4000,
          title: "Aggregate Results",
          description:
            "All parallel task results are collected. Successful thumbnails and any failures are combined into the response.",
        },
        {
          id: "step10",
          activeNodes: ["results", "ui-trigger"],
          activeEdges: ["results-ui"],
          duration: 4000,
          title: "Display Thumbnails",
          description:
            "The API returns the thumbnail URLs to the frontend, which displays them in a grid for the user to download or share.",
        },
      ],
    },
  ],
};

export function WorkflowPage() {
  return (
    <div>
      <WorkflowVisualizer config={workflowConfig} defaultSelectedNode="ui-trigger" />
    </div>
  );
}
