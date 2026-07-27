/** 買い物先プロファイル（大容量購入の前提など） */
export type StoreProfile = {
  id: string;
  name: string;
  /** 大容量パック購入を前提にするか */
  prefersBulkPurchase: boolean;
  /** 必要量に対するパックサイズ倍率の目安（例: 1.5） */
  defaultPackSizeMultiplier: number;
  /** 価格履歴を使うか */
  priceHistoryEnabled: boolean;
  notes: string;
};

export const LOPIA_STORE_PROFILE_ID = "store-lopia";

/** ロピア向け初期プロファイル */
export const LOPIA_STORE_PROFILE: StoreProfile = {
  id: LOPIA_STORE_PROFILE_ID,
  name: "ロピア",
  prefersBulkPurchase: true,
  defaultPackSizeMultiplier: 1.5,
  priceHistoryEnabled: true,
  notes: "大容量パック購入を前提にした買い物先",
};

export const DEFAULT_STORE_PROFILES: StoreProfile[] = [LOPIA_STORE_PROFILE];
