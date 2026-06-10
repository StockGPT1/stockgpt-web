type RedisCommandPart = string | number;
type RedisCommand = RedisCommandPart[];

type UpstashPipelineResponse = Array<{
  result?: unknown;
  error?: string;
}>;

const REDIS_COMMAND_TIMEOUT_MS = Number(
  process.env.REDIS_COMMAND_TIMEOUT_MS ?? 250,
);
const REDIS_DISABLED_COOLDOWN_MS = Number(
  process.env.REDIS_DISABLED_COOLDOWN_MS ?? 5 * 60 * 1000,
);

let endpoint: string | null | undefined;
let token: string | null | undefined;
let disabledUntil = 0;
let hasLoggedFailure = false;

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

export function isRedisConfigured() {
  return Boolean(getEndpoint() && getToken());
}

function isRedisTemporarilyDisabled() {
  return Date.now() < disabledUntil;
}

function disableRedis(reason: string, detail?: unknown) {
  disabledUntil = Date.now() + REDIS_DISABLED_COOLDOWN_MS;

  if (!hasLoggedFailure) {
    hasLoggedFailure = true;
    console.warn("Redis disabled temporarily", { reason, detail });
  }
}

export function forceRedisCooldown() {
  disabledUntil = Date.now() + REDIS_DISABLED_COOLDOWN_MS;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export async function redisPipeline<T = unknown>(
  commands: RedisCommand[],
): Promise<Array<T | null>> {
  if (commands.length === 0) return [];

  const redisEndpoint = getEndpoint();
  const redisToken = getToken();

  if (!redisEndpoint || !redisToken || isRedisTemporarilyDisabled()) {
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
      disableRedis("bad_response", {
        status: response.status,
        statusText: response.statusText,
      });
      return commands.map(() => null);
    }

    const json = (await response.json()) as UpstashPipelineResponse;

    return commands.map((_, index) => {
      const item = json[index];
      if (!item || item.error) {
        if (item?.error) disableRedis("command_error", item.error);
        return null;
      }
      return (item.result ?? null) as T | null;
    });
  } catch (error) {
    disableRedis(isAbortError(error) ? "timeout" : "unavailable", error);
    return commands.map(() => null);
  } finally {
    clearTimeout(timeout);
  }
}

export async function redisCommand<T = unknown>(
  command: RedisCommand,
): Promise<T | null> {
  const [result] = await redisPipeline<T>([command]);
  return result ?? null;
}
