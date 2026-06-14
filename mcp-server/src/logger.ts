type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50
};

export function createLogger(scope: string) {
  return {
    debug(message: string, meta?: Record<string, unknown>) {
      writeLog("debug", scope, message, meta);
    },
    info(message: string, meta?: Record<string, unknown>) {
      writeLog("info", scope, message, meta);
    },
    warn(message: string, meta?: Record<string, unknown>) {
      writeLog("warn", scope, message, meta);
    },
    error(message: string, meta?: Record<string, unknown>) {
      writeLog("error", scope, message, meta);
    }
  };
}

function writeLog(
  level: Exclude<LogLevel, "silent">,
  scope: string,
  message: string,
  meta: Record<string, unknown> = {}
) {
  const configuredLevel = parseLogLevel(process.env.MCP_LOG_LEVEL);

  if (levelPriority[level] < levelPriority[configuredLevel]) {
    return;
  }

  const payload = {
    time: new Date().toISOString(),
    level,
    scope,
    message,
    ...normalizeMeta(meta)
  };

  process.stderr.write(`${JSON.stringify(payload)}\n`);
}

function parseLogLevel(value: string | undefined): LogLevel {
  if (
    value === "debug" ||
    value === "info" ||
    value === "warn" ||
    value === "error" ||
    value === "silent"
  ) {
    return value;
  }

  return "info";
}

function normalizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(meta).map(([key, value]) => [key, normalizeValue(value)])
  );
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }

  return value;
}
