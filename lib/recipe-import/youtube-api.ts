/**
 * YouTube Data API (videos.list) — サーバー専用
 * 動画ファイル・字幕は取得しない。
 */
import { isValidYoutubeVideoId } from "@/lib/recipe-import/youtube-url";

export type YoutubeSnippet = {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  canonicalUrl: string;
};

export type YoutubeApiErrorCode =
  | "missing_api_key"
  | "invalid_video_id"
  | "not_found"
  | "private_or_unavailable"
  | "api_quota"
  | "api_failed";

export type YoutubeApiResult =
  | { ok: true; snippet: YoutubeSnippet }
  | { ok: false; code: YoutubeApiErrorCode; message: string; detail?: string };

type YoutubeVideosListResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      description?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: {
        maxres?: { url?: string };
        standard?: { url?: string };
        high?: { url?: string };
        medium?: { url?: string };
        default?: { url?: string };
      };
    };
    status?: {
      privacyStatus?: string;
      embeddable?: boolean;
    };
  }>;
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{ reason?: string; message?: string }>;
  };
};

function pickThumbnail(
  thumbs: NonNullable<
    NonNullable<YoutubeVideosListResponse["items"]>[number]["snippet"]
  >["thumbnails"],
): string | null {
  if (!thumbs) return null;
  return (
    thumbs.maxres?.url ??
    thumbs.standard?.url ??
    thumbs.high?.url ??
    thumbs.medium?.url ??
    thumbs.default?.url ??
    null
  );
}

export function getYoutubeApiKey(): string | null {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  return key || null;
}

/**
 * videos.list で snippet を取得する。
 */
export async function fetchYoutubeVideoSnippet(
  videoId: string,
): Promise<YoutubeApiResult> {
  if (!isValidYoutubeVideoId(videoId)) {
    return {
      ok: false,
      code: "invalid_video_id",
      message: "動画IDの形式が正しくありません",
    };
  }

  const apiKey = getYoutubeApiKey();
  if (!apiKey) {
    return {
      ok: false,
      code: "missing_api_key",
      message:
        "YouTube APIキーが設定されていません（サーバーの YOUTUBE_API_KEY）",
    };
  }

  const endpoint = new URL("https://www.googleapis.com/youtube/v3/videos");
  endpoint.searchParams.set("part", "snippet,status");
  endpoint.searchParams.set("id", videoId);
  endpoint.searchParams.set("key", apiKey);

  let response: Response;
  try {
    response = await fetch(endpoint.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch (error) {
    return {
      ok: false,
      code: "api_failed",
      message: "YouTube APIへの接続に失敗しました",
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  let payload: YoutubeVideosListResponse;
  try {
    payload = (await response.json()) as YoutubeVideosListResponse;
  } catch {
    return {
      ok: false,
      code: "api_failed",
      message: "YouTube APIの応答を読み取れませんでした",
    };
  }

  if (!response.ok || payload.error) {
    const reason = payload.error?.errors?.[0]?.reason ?? "";
    const apiMessage = payload.error?.message ?? `HTTP ${response.status}`;
    if (reason === "quotaExceeded" || response.status === 403) {
      return {
        ok: false,
        code: reason === "quotaExceeded" ? "api_quota" : "api_failed",
        message:
          reason === "quotaExceeded"
            ? "YouTube APIの利用上限に達しました。しばらくしてから再試行してください"
            : `YouTube APIの取得に失敗しました（${apiMessage}）`,
        detail: apiMessage,
      };
    }
    return {
      ok: false,
      code: "api_failed",
      message: `YouTube APIの取得に失敗しました（${apiMessage}）`,
      detail: apiMessage,
    };
  }

  const item = payload.items?.[0];
  if (!item) {
    return {
      ok: false,
      code: "not_found",
      message:
        "動画が見つかりませんでした。削除済み・非公開・またはURLが誤っている可能性があります",
    };
  }

  const privacy = item.status?.privacyStatus;
  if (privacy === "private") {
    return {
      ok: false,
      code: "private_or_unavailable",
      message: "非公開動画のため情報を取得できません",
    };
  }

  const snippet = item.snippet;
  if (!snippet) {
    return {
      ok: false,
      code: "private_or_unavailable",
      message: "動画情報を取得できませんでした（非公開または制限付きの可能性）",
    };
  }

  return {
    ok: true,
    snippet: {
      videoId,
      title: snippet.title?.trim() || "無題の動画",
      description: snippet.description ?? "",
      channelTitle: snippet.channelTitle?.trim() || "",
      publishedAt: snippet.publishedAt ?? null,
      thumbnailUrl: pickThumbnail(snippet.thumbnails),
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    },
  };
}
