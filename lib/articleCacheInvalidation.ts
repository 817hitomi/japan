import { articleCacheInvalidationHeader, isValidPublicArticleRouteKey } from "./articleEdgeCache.ts";

export function withArticleCacheInvalidation(response: Response, routeKeys: Array<string | number | null | undefined>) {
  const keys = Array.from(new Set(
    routeKeys.map((key) => String(key ?? "").trim()).filter((key) => isValidPublicArticleRouteKey(key))
  ));

  if (keys.length > 0) response.headers.set(articleCacheInvalidationHeader, keys.join(","));
  return response;
}
