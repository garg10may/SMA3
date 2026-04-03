import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const UV_BINARY = process.env.UV_BIN?.trim() || "uv";
const MANIM_PACKAGE = process.env.MANIM_PACKAGE?.trim() || "manim==0.20.1";
const MANIM_PYTHON_VERSION =
  process.env.MANIM_PYTHON_VERSION?.trim() || "3.12";
const HOMEBREW_BIN = "/opt/homebrew/bin";
const OUTPUT_MARKER = "__INFOGRAPHIC_OUTPUT__=";
const DEFAULT_PIXEL_WIDTH = 1440;
const DEFAULT_PIXEL_HEIGHT = 810;
const DEFAULT_BACKGROUND = "#f7f2e7";

type RenderManimSceneInput = {
  pythonSource: string;
  sceneClassName: string;
  requestId: string;
};

type RenderManimSceneResult = {
  pngDataUrl: string;
  stdout: string;
  stderr: string;
};

function buildRunnerSource() {
  return [
    "from pathlib import Path",
    "import importlib.util",
    "import os",
    "",
    "from manim import config",
    "",
    "",
    "scene_path = Path(os.environ['INFOGRAPHIC_SCENE_PATH'])",
    "scene_class_name = os.environ['INFOGRAPHIC_SCENE_CLASS']",
    "render_root = Path(os.environ['INFOGRAPHIC_RENDER_ROOT'])",
    "render_root.mkdir(parents=True, exist_ok=True)",
    "",
    "config.media_dir = str(render_root)",
    "config.output_file = os.environ.get('INFOGRAPHIC_OUTPUT_NAME', 'poster')",
    "config.save_last_frame = True",
    "config.write_to_movie = False",
    "config.pixel_width = int(os.environ.get('INFOGRAPHIC_PIXEL_WIDTH', '1440'))",
    "config.pixel_height = int(os.environ.get('INFOGRAPHIC_PIXEL_HEIGHT', '810'))",
    "config.background_color = os.environ.get('INFOGRAPHIC_BG', '#f7f2e7')",
    "",
    "spec = importlib.util.spec_from_file_location('infographic_scene_module', scene_path)",
    "if spec is None or spec.loader is None:",
    "    raise RuntimeError('Could not load the generated scene module.')",
    "module = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(module)",
    "scene_class = getattr(module, scene_class_name)",
    "scene = scene_class()",
    "scene.render()",
    "",
    "png_files = sorted(render_root.rglob('*.png'), key=lambda path: path.stat().st_mtime, reverse=True)",
    "if not png_files:",
    "    raise RuntimeError('Manim did not produce a PNG output.')",
    `print(f'${OUTPUT_MARKER}{png_files[0]}')`,
    "",
  ].join("\n");
}

function buildCommandEnvironment(tempDir: string) {
  return {
    ...process.env,
    PATH: `${HOMEBREW_BIN}:${process.env.PATH ?? ""}`,
    PYTHONPATH: [
      tempDir,
      process.env.PYTHONPATH ?? "",
    ]
      .filter(Boolean)
      .join(":"),
    INFOGRAPHIC_OUTPUT_NAME: "poster",
    INFOGRAPHIC_PIXEL_WIDTH: String(DEFAULT_PIXEL_WIDTH),
    INFOGRAPHIC_PIXEL_HEIGHT: String(DEFAULT_PIXEL_HEIGHT),
    INFOGRAPHIC_BG: DEFAULT_BACKGROUND,
  };
}

function findOutputPath(stdout: string, stderr: string) {
  const combined = `${stdout}\n${stderr}`.trim();
  const match = combined.match(
    new RegExp(`${OUTPUT_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(.*)`),
  );

  if (!match?.[1]?.trim()) {
    throw new Error("Manim finished without printing the rendered PNG path.");
  }

  return match[1].trim();
}

async function readInfographicRuntimeSource() {
  return readFile(
    join(process.cwd(), "tools", "manim", "infographic_runtime.py"),
    "utf8",
  );
}

export async function renderManimScene(
  input: RenderManimSceneInput,
): Promise<RenderManimSceneResult> {
  const tempDir = await mkdtemp(join(tmpdir(), "sma3-manim-"));
  const scenePath = join(tempDir, "scene.py");
  const runtimePath = join(tempDir, "infographic_runtime.py");
  const runnerPath = join(tempDir, "render_scene.py");
  const renderRoot = join(tempDir, "rendered");

  try {
    const runtimeSource = await readInfographicRuntimeSource();

    await writeFile(scenePath, `${input.pythonSource.trim()}\n`, "utf8");
    await writeFile(runtimePath, runtimeSource, "utf8");
    await writeFile(runnerPath, buildRunnerSource(), "utf8");

    const { stdout, stderr } = await execFileAsync(
      UV_BINARY,
      [
        "run",
        "--python",
        MANIM_PYTHON_VERSION,
        "--with",
        MANIM_PACKAGE,
        "python",
        runnerPath,
      ],
      {
        cwd: tempDir,
        env: {
          ...buildCommandEnvironment(tempDir),
          INFOGRAPHIC_SCENE_PATH: scenePath,
          INFOGRAPHIC_SCENE_CLASS: input.sceneClassName,
          INFOGRAPHIC_RENDER_ROOT: renderRoot,
          INFOGRAPHIC_REQUEST_ID: input.requestId,
        },
        timeout: 240_000,
        maxBuffer: 12 * 1024 * 1024,
      },
    );

    const outputPath = findOutputPath(stdout, stderr);
    const pngBuffer = await readFile(outputPath);
    const pngDataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;

    return {
      pngDataUrl,
      stdout,
      stderr,
    };
  } finally {
    if (process.env.KEEP_INFOGRAPHIC_MANIM_TEMP?.trim() !== "1") {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
