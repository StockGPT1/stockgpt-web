import { redisCommand, redisPipeline } from "@/lib/redis";

const MAX_REDIS_VALUE_BYTES = Number(
  process.env.MAX_REDIS_VALUE_BYTES ?? 750_000,
);

function byteSize(value: string) {
  return new TextEncoder().encode(value).length;
}

function parseJsonValue<T>(value: unknown): T | null {
  if (value == null) return null;

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  if (typeof value === "object") {
    return value as T;
  }

  return value as T;
}

export async function getJsonCache<T>(key: string): Promise<T | null> {
  try {
    const value = await redisCommand<unknown>(["GET", key]);
    return parseJsonValue<T>(value);
  } catch (error) {
    console.warn("Redis cache read failed", { key, error });
    return null;
  }
}

export async function getJsonCacheMany<T>(
  keys: string[],
): Promise<Map<string, T>> {
  const result = new Map<string, T>();
  if (keys.length === 0) return result;

  try {
    const values = await redisPipeline<unknown>(keys.map((key) => ["GET", key]));

    values.forEach((value, index) => {
      const parsed = parseJsonValue<T>(value);
      if (parsed !== null) result.set(keys[index], parsed);
    });
  } catch (error) {
    console.warn("Redis cache batch read failed", { keys: keys.length, error });
  }

  return result;
}

export async function setJsonCache<T>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  try {
    const payload = JSON.stringify(value);

    if (byteSize(payload) > MAX_REDIS_VALUE_BYTES) {
      console.warn("Redis cache payload skipped because it is too large", { key });
      return;
    }

    await redisCommand<string>([
      "SET",
      key,
      payload,
      "EX",
      Math.max(1, Math.round(ttlSeconds)),
    ]);
  } catch (error) {
    console.warn("Redis cache write failed", { key, error });
  }
}

export async function deleteCacheKey(key: string): Promise<void> {
  try {
    await redisCommand<number>(["DEL", key]);
  } catch (error) {
    console.warn("Redis cache delete failed", { key, error });
  }
}

export async function rememberJson<T>({
  key,
  ttlSeconds,
  getFresh,
}: {
  key: string;
  ttlSeconds: number;
  getFresh: () => Promise<T>;
}): Promise<T> {
  const cached = await getJsonCache<T>(key);
  if (cached !== null) return cached;

  const fresh = await getFresh();
  await setJsonCache(key, fresh, ttlSeconds);
  return fresh;
}
