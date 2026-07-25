# 家族共有の仕組み

## 共有単位

ユーザー個人ではなく **household（家庭）** が共有単位です。

- `profiles` … 表示名
- `households` … 家庭
- `household_members` … 所属と役割（owner / member）
- `household_invites` … 招待コード

## データアクセス

すべての共有データは `household_id` を持ち、Row Level Security により  
**自分が所属する家庭のデータのみ** 閲覧・編集できます。

UUID を知っていても他家庭のデータにはアクセスできません。

## 同期方式

1. ログイン + 家庭所属後、クラウドから端末へ pull
2. 端末の localStorage を既存 UI が読み書き
3. localStorage 変更を検知してクラウドへ遅延 push
4. ウィンドウフォーカス時に再 pull
5. 設定画面から手動で「最新データを取得」

## 招待

- owner のみ招待コード発行可能
- コードは推測されにくい英数字
- 有効期限あり、使用済みは再利用不可
- 参加は RPC `join_household_with_invite` 経由
