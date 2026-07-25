/**
 * 残量のプリセット。
 * 献立の在庫優先ロジックでも同じ識別子を使えるようにする。
 */
export type AmountPreset = "little" | "half" | "lot";

/**
 * 残量の表現。
 * - preset: 少し / 半分 / たくさん
 * - text: 自由記述（「2本」「適量」など）
 * - quantity: 将来の数値計算用（未使用でも型として確保）
 */
export type InventoryAmount =
  | {
      kind: "preset";
      preset: AmountPreset;
    }
  | {
      kind: "text";
      value: string;
    }
  | {
      kind: "quantity";
      value: number;
      /** 将来の厳密な単位換算用。現時点では未使用可 */
      unitCode?: string;
    };

/** 冷蔵庫の食材（在庫） */
export type InventoryItem = {
  id: string;
  name: string;
  /** 残量。未設定は null */
  amount: InventoryAmount | null;
  /** 表示・入力用の単位（例: 個, g, 本）。空文字可 */
  unit: string;
  /** 優先して使う（⭐） */
  priority: boolean;
  createdAt: string;
  updatedAt: string;
  /**
   * 将来拡張用の予約フィールドはここに足す。
   * 例: expiresAt?: string | null; categoryId?: string | null;
   */
};

/** フォーム入力用 */
export type InventoryInput = {
  name: string;
  amount: InventoryAmount | null;
  unit: string;
  priority: boolean;
};

/** プリセットの表示ラベル */
export const AMOUNT_PRESET_LABELS: Record<AmountPreset, string> = {
  little: "少し",
  half: "半分",
  lot: "たくさん",
};

export const AMOUNT_PRESETS: AmountPreset[] = ["little", "half", "lot"];
