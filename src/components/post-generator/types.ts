import type { MediumImageStyleOption } from "@/lib/medium-image";
import type { MemeTemplate } from "@/lib/meme-agent";
import type {
  ImageModelOption,
  ImageQualityOption,
  PlatformOption,
  ReasoningEffortOption,
  TextModelOption,
} from "@/lib/post-config";
import type {
  ShortDurationOption,
  ShortTargetOption,
} from "@/lib/short-config";

export type PostVariant = {
  post: string;
  characters: number;
};

export type ThreadPost = {
  text: string;
  characters: number;
};

export type ThreadVariant = {
  posts: ThreadPost[];
};

export type PostResult = {
  format: "post";
  variants: PostVariant[];
};

export type ThreadResult = {
  format: "thread";
  variants: ThreadVariant[];
};

export type MediumResult = {
  format: "medium";
  title: string;
  excerpt: string;
  markdown: string;
  words: number;
  leadImageAlt: string;
  leadImageDataUrl: string | null;
  imagePrompt: string;
  imageStyle: MediumImageStyleOption;
  model: TextModelOption;
  reasoningEffort: ReasoningEffortOption;
  imageModel: ImageModelOption;
  imageQuality: ImageQualityOption;
  mathEmbeds: {
    token: string;
    latex: string;
    url: string;
    embedUrl: string;
    width: number;
    height: number;
  }[];
};

export type MediumImageResponse = {
  leadImageAlt: string;
  leadImageDataUrl: string;
  imagePrompt: string;
  imageStyle: MediumImageStyleOption;
  imageModel: ImageModelOption;
  imageQuality: ImageQualityOption;
  requestId?: string;
};

export type MediumImageVersion = MediumImageResponse & {
  id: string;
};

export type ShortPack = {
  title: string;
  hook: string;
  caption: string;
  hashtags: string[];
  videoPrompt: string;
  shotPlan: string[];
  audioDirection: string;
};

export type ShortStatus = "queued" | "in_progress" | "completed" | "failed";

export type ShortJob = {
  format: "short";
  jobId: string;
  status: ShortStatus;
  progress: number;
  createdAt: number | null;
  completedAt: number | null;
  expiresAt: number | null;
  seconds: ShortDurationOption;
  size: string;
  model: string;
  target: ShortTargetOption;
  targetLabel: string;
  estimatedCostUsd: number;
  errorMessage: string | null;
  requestId?: string;
};

export type ShortResult = ShortJob & {
  pack: ShortPack;
};

export type XResponse = PostResult | ThreadResult;
export type GenerateResponse = XResponse | MediumResult;
export type ShortCreateResponse = ShortResult;
export type ShortStatusResponse = ShortJob;

export type MemeVariant = {
  template: {
    id: string;
    name: string;
    lineCount: number;
    helper: string;
  };
  title: string;
  rationale: string;
  lines: string[];
  imageUrl: string;
  blankUrl: string;
};

export type MemeResult = {
  format: "meme";
  variants: MemeVariant[];
  model: TextModelOption;
  reasoningEffort: ReasoningEffortOption;
  requestId?: string;
};

export type MemeResponse = MemeResult;

export type MemeTemplatesResponse = {
  templates: MemeTemplate[];
  count: number;
  usingFallback: boolean;
  requestId?: string;
};

export type ChannelWorkspace = PlatformOption | "shorts";
export type AgentWorkspace = "meme";
export type WorkspaceId = ChannelWorkspace | AgentWorkspace;

export type ErrorResponse = {
  error?: string;
  requestId?: string;
};
