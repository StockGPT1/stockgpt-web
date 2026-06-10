type RedisCommandPart = string | number;
type RedisCommand = RedisCommandPart[];

type UpstashPipelineResponse = Array<{
  result?: unknown;
  error?: string;
}>;

type RedisPipelineOptions = {
  ignoreCooldown?: boolean;
  logCommandErrors?: boolean;
};

type RedisHealthCheck = {
  configured: boolean;
  ok: boolean;
  disabled: boolean;
  ping: boolean;
  set: boolean;
  get: boolean;
  del: boolean;
  latencyMs: number;
  endpointHost: string | null;
  error: string | null;
};

const REDIS_COMMAND_TIMEOUT_MS = Number(process.env.REDIS_COMMAND_TIMEOUT_MS ?? 3_000);
const REDIS_DISABLED_COOLDOWN_MS = Number(process.env.REDIS_DISABLED_COOLDOWN_MS ?? 60 * 1000);

let endpoint: string | null | undefined;
let token: string | null | undefined;
let disabledUntil = 0;
let lastWarningAt = 0;
let hasLoggedCommandError = false;

function getEndpoint() {
  if (endpoint !== undefined) return endpoint;
  const raw = process.env.UPSTASH_REDIS_REST_URL?.trim();
  endpoint = raw ? raw.replace(/\/$/, "") : null;
  return endpoint;
}

function getToken() {
  if (token !== undefined) return token;
  const raw = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  token = raw || null;
  return token;
}

function getEndpointHost() {
  const redisEndpoint = getEndpoint();
  if (!redisEndpoint) return null;

  try {
    return new URL(redisEndpoint).host;
  } catch {
    return "invalid-url";
  }
}

export function isRedisConfigured() {
  return Boolean(getEndpoint() && getToken());
}

function isRedisTemporarilyDisabled() {
  return Date.now() < disabledUntil;
}

function safeDetail(detail: unknown) {
  if (detail == null) return "";
  if (typeof detail === "string") return detail.slice(0, 160);
  if (detail instanceof Error) return `${detail.name}: ${detail.message}`.slice(0, 160);

  try {
    return JSON.stringify(detail).slice(0, 160);
  } catch {
    return String(detail).slice(0, 160);
  }
}

function warnRedis(reason: string, detail?: unknown) {
  const now = Date.now();
  if (now - lastWarningAt < 60_000) return;
  lastWarningAt = now;
  console.warn(`REDIS_CACHE_MISS reason=${reason}${detail ? ` detail=${safeDetail(detail)}` : ""}`);
}

function cooldownRedis(reason: string, detail?: unknown) {
  disabledUntil = Date.now() + REDIS_DISABLED_COOLDOWN_MS;
  warnRedis(reason, detail);
}

function logCommandError(detail?: unknown) {
  if (!hasLoggedCommandError) {
    hasLoggedCommandError = true;
    warnRedis("command_error", detail);
  }
}

export function forceRedisCooldown() {
  disabledUntil = Date.now() + REDIS_DISABLED_COOLDOWN_MS;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

async function redisPipelineInternal<T = unknown>(commands: RedisCommand[], options: RedisPipelineOptions = {}): Promise<Array<T | null>> {
  if (commands.length === 0) return [];

  const redisEndpoint = getEndpoint();
  const redisToken = getToken();

  if (!redisEndpoint || !redisToken || (!options.ignoreCooldown && isRedisTemporarilyDisabled())) {
    return commands.map(() => null);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REDIS_COMMAND_TIMEOUT_MS);

  try {
    const response = await fetch(`${redisEndpoint}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = {
        status: response.status,
        statusText: response.statusText,
        host: getEndpointHost(),
      };

      if (response.status === 401 || response.status === 403 || response.status === 404 || response.status === 429) {
        cooldownRedis("bad_response", detail);
      } else {
        warnRedis("bad_response", detail);
      }

      return commands.map(() => null);
    }

    const json = (await response.json()) as UpstashPipelineResponse;

    return commands.map((_, index) => {
      const item = json[index];
      if (!item || item.error) {
        if (item?.error && options.logCommandErrors !== false) logCommandError(item.error);
        return null;
      }
      return (item.result ?? null) as T | null;
    });
  } catch (error) {
    // Important: transient Upstash/network timeouts should be cache misses, not a global Redis shutdown.
    warnRedis(isAbortError(error) ? "timeout" : "unavailable", error);
    return commands.map(() => null);
  } finally {
    clearTimeout(timeout);
  }
}

export async function redisPipeline<T = unknown>(commands: RedisCommand[]): Promise<Array<T | null>> {
  return redisPipelineInternal<T>(commands);
}

export async function redisCommand<T = unknown>(command: RedisCommand): Promise<T | null> {
  const [result] = await redisPipeline<T>([command]);
  return result ?? null;
}

export async function checkRedisHealth(): Promise<RedisHealthCheck> {
  const started = Date.now();
  const key = `stockgpt:health:${Date.now()}`;
  const configured = isRedisConfigured();
  const disabled = isRedisTemporarilyDisabled();

  if (!configured) {
    return {
      configured,
      ok: false,
      disabled,
      ping: false,
      set: false,
      get: false,
      del: false,
      latencyMs: Date.now() - started,
      endpointHost: getEndpointHost(),
      error: "missing_url_or_token",
    };
  }

  try {
    const [ping, set, get, del] = await redisPipelineInternal<unknown>(
      [
        ["PING"],
        ["SET", key, "ok", "EX", 30],
        ["GET", key],
        ["DEL", key],
      ],
      { ignoreCooldown: true, logCommandErrors: false },
    );

    const result: RedisHealthCheck = {
      configured,
      ok: ping === "PONG" && set === "OK" && get === "ok" && Number(del) >= 1,
      disabled,
      ping: ping === "PONG",
      set: set === "OK",
      get: get === "ok",
      del: Number(del) >= 1,
      latencyMs: Date.now() - started,
      endpointHost: getEndpointHost(),
      error: null,
    };

    if (!result.ok) result.error = `unexpected_result:${JSON.stringify({ ping, set, get, del }).slice(0, 180)}`;

    return result;
  } catch (error) {
    return {
      configured,
      ok: false,
      disabled,
      ping: false,
      set: false,
      get: false,
      del: false,
      latencyMs: Date.now() - started,
      endpointHost: getEndpointHost(),
      error: safeDetail(error) || "unknown_error",
    };
  }
}
