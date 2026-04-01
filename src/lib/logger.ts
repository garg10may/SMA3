type LogLevel = "debug" | "info" | "warn" | "error";

type LogMetadata = Record<string, unknown>;

type SerializableObject = Record<string, unknown>;

export function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    const detail = error as Error & {
      cause?: unknown;
      code?: unknown;
      request_id?: unknown;
      status?: unknown;
      type?: unknown;
    };

    return compactObject({
      name: detail.name,
      message: detail.message,
      stack: detail.stack,
      status: detail.status,
      code: detail.code,
      type: detail.type,
      requestId: detail.request_id,
      cause: detail.cause ? serializeError(detail.cause) : undefined,
    });
  }

  if (Array.isArray(error)) {
    return error.map((value) => serializeValue(value));
  }

  if (typeof error === "object" && error !== null) {
    return compactObject(
      Object.fromEntries(
        Object.entries(error).map(([key, value]) => [key, serializeValue(value)]),
      ),
    );
  }

  return error;
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return serializeError(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeValue(entry));
  }

  if (typeof value === "object" && value !== null) {
    return compactObject(
      Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, serializeValue(entry)]),
      ),
    );
  }

  return value;
}

function compactObject(value: SerializableObject) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );
}

function serializeMetadata(metadata?: LogMetadata) {
  if (!metadata) {
    return {};
  }

  return compactObject(
    Object.fromEntries(
      Object.entries(metadata).map(([key, value]) => [key, serializeValue(value)]),
    ),
  );
}

function writeLog(level: LogLevel, scope: string, message: string, metadata?: LogMetadata) {
  const prefix = `[${scope}] ${message}`;
  const entry = {
    timestamp: new Date().toISOString(),
    ...serializeMetadata(metadata),
  };

  const hasMetadata = Object.keys(entry).length > 1;

  switch (level) {
    case "debug":
      if (hasMetadata) {
        console.debug(prefix, entry);
        return;
      }
      console.debug(prefix);
      return;
    case "info":
      if (hasMetadata) {
        console.info(prefix, entry);
        return;
      }
      console.info(prefix);
      return;
    case "warn":
      if (hasMetadata) {
        console.warn(prefix, entry);
        return;
      }
      console.warn(prefix);
      return;
    case "error":
      if (hasMetadata) {
        console.error(prefix, entry);
        return;
      }
      console.error(prefix);
      return;
  }
}

export function logError(scope: string, message: string, metadata?: LogMetadata) {
  writeLog("error", scope, message, metadata);
}

export function logInfo(scope: string, message: string, metadata?: LogMetadata) {
  writeLog("info", scope, message, metadata);
}

export function logWarn(scope: string, message: string, metadata?: LogMetadata) {
  writeLog("warn", scope, message, metadata);
}
