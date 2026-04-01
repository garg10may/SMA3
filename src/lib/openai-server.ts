import OpenAI from "openai";
import { ProxyAgent } from "undici";

function readRequiredApiKey() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing on the server.");
  }

  return apiKey;
}

export function shouldUseOpenAIProxy() {
  const raw = process.env.OPENAI_USE_PROXY?.trim().toLowerCase();

  if (!raw) {
    return true;
  }

  return raw !== "false" && raw !== "0" && raw !== "off";
}

export function readOpenAIProxyUrl() {
  const proxyUrl = process.env.OPENAI_PROXY_URL?.trim();

  if (!proxyUrl) {
    throw new Error(
      "OPENAI proxying is enabled but OPENAI_PROXY_URL is missing.",
    );
  }

  try {
    return new URL(proxyUrl).toString();
  } catch {
    throw new Error("OPENAI_PROXY_URL must be a valid absolute URL.");
  }
}

let proxyAgent: ProxyAgent | null = null;
let proxyAgentUrl = "";

function getProxyAgent(proxyUrl: string) {
  if (!proxyAgent || proxyAgentUrl !== proxyUrl) {
    proxyAgent = new ProxyAgent(proxyUrl);
    proxyAgentUrl = proxyUrl;
  }

  return proxyAgent;
}

export function getOpenAIProxyFetchOptions() {
  if (!shouldUseOpenAIProxy()) {
    return {};
  }

  const proxyUrl = readOpenAIProxyUrl();

  return {
    dispatcher: getProxyAgent(proxyUrl),
  };
}

export function createOpenAIClient() {
  const apiKey = readRequiredApiKey();

  if (!shouldUseOpenAIProxy()) {
    return new OpenAI({ apiKey });
  }

  return new OpenAI({
    apiKey,
    fetchOptions: {
      ...getOpenAIProxyFetchOptions(),
    },
  });
}
