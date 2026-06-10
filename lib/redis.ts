type RedisCommandPart = string | number;
type RedisCommand = RedisCommandPart[];

type UpstashPipelineResponse = Array<{
  result?: unknown;
  error?: string;
}>;

const REDIS_COMMAND_TIMEOUT_MS = Number(
  process.env.REDIS_COMMAND_TIMEOUT_MS ?? 1_500,
);

let endpoint: string | null | undefined;
let token: string | null | undefined;

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

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export async function redisPipeline<T = unknown>(
  commands: RedisCommand[],
): Promise<Array<T | null>> {
  if (commands.length === 0) return [];

  const redisEndpoint = getEndpoint();
  const redisToken = getToken();

  if (!redisEndpoint || !redisToken) {
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
      console.warn("Redis pipeline failed", {
        status: response.status,
        statusText: response.statusText,
      });
      return commands.map(() => null);
    }

    const json = (await response.json()) as UpstashPipelineResponse;

    return commands.map((_, index) => {
      const item = json[index];
      if (!item || item.error) {
        if (item?.error) console.warn("Redis command failed", item.error);
        return null;
      }
      return (item.result ?? null) as T | null;
    });
  } catch (error) {
    if (!isAbortError(error)) {
      console.warn("Redis pipeline unavailable", error);
    }
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
