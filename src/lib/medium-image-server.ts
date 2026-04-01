import OpenAI from "openai";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_QUALITY,
  type ImageQualityOption,
  type ImageModelOption,
} from "@/lib/post-config";
import {
  buildMediumLeadImagePrompt,
  type MediumImageStyleOption,
} from "@/lib/medium-image";

type GenerateMediumLeadImageInput = {
  openai: OpenAI;
  brief: string;
  audience: string;
  mediumGoal: string;
  imageStyle: MediumImageStyleOption;
  imageModel?: ImageModelOption;
  imageQuality?: ImageQualityOption;
  imagePrompt?: string;
  title?: string;
  excerpt?: string;
};

export async function generateMediumLeadImage(
  input: GenerateMediumLeadImageInput,
) {
  const prompt = buildMediumLeadImagePrompt({
    brief: input.brief,
    audience: input.audience,
    mediumGoal: input.mediumGoal,
    imageStyle: input.imageStyle,
    customPrompt: input.imagePrompt,
    title: input.title,
    excerpt: input.excerpt,
  });

  const imageResponse = await input.openai.images.generate({
    model: input.imageModel ?? DEFAULT_IMAGE_MODEL,
    prompt,
    size: "1536x1024",
    quality: input.imageQuality ?? DEFAULT_IMAGE_QUALITY,
    output_format: "png",
    background: "opaque",
    n: 1,
    stream: false,
  });

  const imageBase64 = imageResponse.data?.[0]?.b64_json;

  if (!imageBase64) {
    throw new Error("The image model returned an empty image.");
  }

  return {
    leadImageAlt: input.title?.trim()
      ? `Lead image for ${input.title.trim()}`
      : "Lead image for the article",
    leadImageDataUrl: `data:image/png;base64,${imageBase64}`,
    imagePrompt: prompt,
    imageStyle: input.imageStyle,
    imageModel: input.imageModel ?? DEFAULT_IMAGE_MODEL,
    imageQuality: input.imageQuality ?? DEFAULT_IMAGE_QUALITY,
  };
}
