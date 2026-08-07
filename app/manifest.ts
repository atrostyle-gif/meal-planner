import type { MetadataRoute } from "next";

/**
 * PWA / ホーム画面追加用マニフェスト
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MogNote",
    short_name: "MogNote",
    description: "家族のレシピと1週間の献立を管理するアプリ",
    start_url: "/",
    display: "standalone",
    background_color: "#152014",
    theme_color: "#2f6a3a",
    lang: "ja",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
