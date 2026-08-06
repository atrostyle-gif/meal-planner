/**
 * YouTube URL から videoId を安全に抽出する（クライアント・サーバー共用）
 */

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export type YoutubeUrlParseSuccess = {
  ok: true;
  videoId: string;
  canonicalUrl: string;
};

export type YoutubeUrlParseFailure = {
  ok: false;
  code: "empty" | "invalid_url" | "not_youtube" | "missing_video_id";
  message: string;
};

export type YoutubeUrlParseResult =
  | YoutubeUrlParseSuccess
  | YoutubeUrlParseFailure;

function isYoutubeHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "youtu.be" ||
    host === "youtube.com" ||
    host === "www.youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host.endsWith(".youtube.com")
  );
}

function looksLikeVideoId(value: string): boolean {
  return VIDEO_ID_PATTERN.test(value);
}

function pickVideoIdFromPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  // /watch は query 側で処理
  if (parts[0] === "watch") return null;

  // /shorts/VIDEO_ID, /embed/VIDEO_ID, /live/VIDEO_ID, /v/VIDEO_ID
  if (
    (parts[0] === "shorts" ||
      parts[0] === "embed" ||
      parts[0] === "live" ||
      parts[0] === "v") &&
    parts[1] &&
    looksLikeVideoId(parts[1])
  ) {
    return parts[1];
  }

  // youtu.be/VIDEO_ID
  if (parts.length === 1 && looksLikeVideoId(parts[0])) {
    return parts[0];
  }

  return null;
}

/**
 * YouTube URL / 短縮 URL / Shorts から 11桁の videoId を抽出する。
 */
export function extractYoutubeVideoId(rawInput: string): YoutubeUrlParseResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      ok: false,
      code: "empty",
      message: "YouTubeのURLを入力してください",
    };
  }

  let url: URL;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    url = new URL(withProtocol);
  } catch {
    return {
      ok: false,
      code: "invalid_url",
      message: "URLの形式が正しくありません",
    };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      ok: false,
      code: "invalid_url",
      message: "httpまたはhttpsのURLのみ対応しています",
    };
  }

  if (!isYoutubeHost(url.hostname)) {
    return {
      ok: false,
      code: "not_youtube",
      message: "YouTubeのURLではありません（youtube.com / youtu.be のみ対応）",
    };
  }

  const fromQuery = url.searchParams.get("v");
  if (fromQuery && looksLikeVideoId(fromQuery)) {
    return {
      ok: true,
      videoId: fromQuery,
      canonicalUrl: `https://www.youtube.com/watch?v=${fromQuery}`,
    };
  }

  // youtu.be のパス先頭
  if (url.hostname.toLowerCase() === "youtu.be") {
    const id = pickVideoIdFromPath(url.pathname);
    if (id) {
      return {
        ok: true,
        videoId: id,
        canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
      };
    }
  }

  const fromPath = pickVideoIdFromPath(url.pathname);
  if (fromPath) {
    return {
      ok: true,
      videoId: fromPath,
      canonicalUrl: `https://www.youtube.com/watch?v=${fromPath}`,
    };
  }

  return {
    ok: false,
    code: "missing_video_id",
    message: "動画IDをURLから取り出せませんでした",
  };
}

export function isValidYoutubeVideoId(value: string): boolean {
  return looksLikeVideoId(value);
}
