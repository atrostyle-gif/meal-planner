import { NextResponse } from "next/server";
import { runYoutubeImportPipeline } from "@/lib/recipe-import/youtube-pipeline";

type ImportYoutubeRequest = {
  url?: unknown;
};

const recentRequests = new Map<string, number>();
const RATE_LIMIT_MS = 2500;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const prev = recentRequests.get(key) ?? 0;
  if (now - prev < RATE_LIMIT_MS) return true;
  recentRequests.set(key, now);
  return false;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();
    const req = (
      typeof body === "object" && body !== null ? body : {}
    ) as ImportYoutubeRequest;

    if (typeof req.url !== "string" || req.url.trim() === "") {
      return NextResponse.json(
        {
          code: "empty",
          error: "YouTubeのURLを入力してください",
        },
        { status: 400 },
      );
    }

    const url = req.url.trim();
    if (isRateLimited(`youtube:${url}`)) {
      return NextResponse.json(
        {
          code: "rate_limited",
          error: "短時間に操作が集中しています。少し待ってから再試行してください",
        },
        { status: 429 },
      );
    }

    const result = await runYoutubeImportPipeline(url);
    if (!result.ok) {
      const status =
        result.code === "missing_api_key" || result.code === "ai_unavailable"
          ? 503
          : result.code === "not_found" ||
              result.code === "private_or_unavailable"
            ? 404
            : result.code === "api_quota"
              ? 429
              : 400;

      return NextResponse.json(
        {
          code: result.code,
          error: result.error,
          warnings: result.warnings ?? [],
        },
        { status },
      );
    }

    return NextResponse.json({
      draft: result.draft,
      warnings: result.warnings,
      message: result.message,
      video: result.video,
    });
  } catch (error) {
    return NextResponse.json(
      {
        code: "api_failed",
        error:
          error instanceof Error
            ? `取り込み処理でエラーが発生しました: ${error.message}`
            : "取り込み処理でエラーが発生しました",
      },
      { status: 500 },
    );
  }
}
