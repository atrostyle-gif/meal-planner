"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createSupabaseHouseholdRepository } from "@/lib/repositories/supabase/household-repository";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getAppDataMode, type AppDataMode } from "@/lib/supabase/env";
import { toUserFacingError } from "@/lib/supabase/errors";
import {
  getLastSyncableLocalWriteAt,
  LOCAL_DATA_CHANGED_EVENT,
  STORAGE_KEYS,
} from "@/lib/storage";
import {
  detectUnresolvedSyncConflict,
  ensureMigrationGate,
  getLastSyncedAt,
  isLocalPushSuppressed,
  isMigrationCompleted,
  markMigrationCompleted,
  pullCloudToLocal,
  pushLocalToCloud,
  setLastSyncedAt,
  setMigrationMarker,
  shouldShowInitialMigrationPrompt,
  shouldSkipCloudPull,
  type PullResult,
  type PushResult,
  type SyncConflictInfo,
} from "@/lib/sync/cloud-sync";
import type {
  Household,
  HouseholdInvite,
  HouseholdMember,
  Profile,
} from "@/types/household";
import type { Session, User } from "@supabase/supabase-js";

type FamilySessionContextValue = {
  mode: AppDataMode;
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  household: Household | null;
  members: HouseholdMember[];
  syncing: boolean;
  lastSyncError: string | null;
  lastPulledAt: string | null;
  /** 同期成功時の短い通知（数秒で消える） */
  lastSyncMessage: string | null;
  clearSyncMessage: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  createHousehold: (name: string, displayName: string) => Promise<void>;
  joinHousehold: (code: string, displayName?: string) => Promise<void>;
  createInvite: () => Promise<HouseholdInvite>;
  refreshFamily: () => Promise<void>;
  pullLatest: (options?: {
    force?: boolean;
    skipConflictCheck?: boolean;
    notify?: boolean;
  }) => Promise<PullResult | null>;
  migrateLocalToCloud: () => Promise<PushResult | null>;
  /** 初回参加時のみ true（local データあり & migrationCompleted=false） */
  needsMigrationPrompt: boolean;
  /** 端末データを破棄して共有データを使う */
  discardLocalMigration: () => Promise<void>;
  syncConflict: SyncConflictInfo | null;
  resolveSyncConflict: (
    choice: "local" | "cloud" | "merge",
  ) => Promise<void>;
  dismissSyncConflict: () => void;
};

const FamilySessionContext = createContext<FamilySessionContextValue | null>(
  null,
);

export function FamilySessionProvider({ children }: { children: ReactNode }) {
  // SSR と初回クライアント描画を一致させるため、mode/session は useEffect 後に確定する
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<AppDataMode>("local");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [lastPulledAt, setLastPulledAt] = useState<string | null>(null);
  const [needsMigrationPrompt, setNeedsMigrationPrompt] = useState(false);
  const [syncConflict, setSyncConflict] = useState<SyncConflictInfo | null>(
    null,
  );
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);
  const syncMessageTimerRef = useRef<number | null>(null);
  const syncingCountRef = useRef(0);

  const showSyncMessage = useCallback((message: string) => {
    if (syncMessageTimerRef.current !== null) {
      window.clearTimeout(syncMessageTimerRef.current);
    }
    setLastSyncMessage(message);
    syncMessageTimerRef.current = window.setTimeout(() => {
      setLastSyncMessage(null);
      syncMessageTimerRef.current = null;
    }, 4000);
  }, []);

  const beginSync = useCallback(() => {
    syncingCountRef.current += 1;
    setSyncing(true);
  }, []);

  const endSync = useCallback(() => {
    syncingCountRef.current = Math.max(0, syncingCountRef.current - 1);
    if (syncingCountRef.current === 0) {
      setSyncing(false);
    }
  }, []);

  const refreshFamily = useCallback(async () => {
    if (mode !== "supabase") {
      return;
    }
    const client = getSupabaseBrowserClient();
    if (!client) {
      return;
    }
    const repo = createSupabaseHouseholdRepository(client);
    const nextProfile = await repo.getMyProfile();
    const nextHousehold = await repo.getMyHousehold();
    const nextMembers = nextHousehold ? await repo.listMembers() : [];
    setProfile(nextProfile);
    setHousehold(nextHousehold);
    setMembers(nextMembers);
    if (
      nextHousehold?.defaultMealServings != null &&
      nextHousehold.defaultMealServings >= 1
    ) {
      const { saveHouseholdPreferences } = await import(
        "@/lib/meal-preferences"
      );
      saveHouseholdPreferences({
        defaultMealServings: nextHousehold.defaultMealServings,
      });
    }
  }, [mode]);

  const pullLatest = useCallback(
    async (options?: {
      force?: boolean;
      skipConflictCheck?: boolean;
      /** true のとき完了通知を出す（手動同期向け） */
      notify?: boolean;
    }) => {
      if (mode !== "supabase" || !household) {
        return null;
      }
      if (!options?.force && shouldSkipCloudPull()) {
        return null;
      }
      // 初回コピー未完了中は、共有データで上書きしない
      if (!isMigrationCompleted(household.id) && shouldShowInitialMigrationPrompt(household.id)) {
        return null;
      }
      const client = getSupabaseBrowserClient();
      if (!client) {
        return null;
      }

      if (!options?.skipConflictCheck && syncConflict === null) {
        try {
          const conflict = await detectUnresolvedSyncConflict(
            client,
            household.id,
          );
          if (conflict) {
            setSyncConflict(conflict);
            return null;
          }
        } catch {
          // 競合判定失敗時は通常の自動マージへ続行
        }
      }

      const hadLocalChanges =
        getLastSyncableLocalWriteAt() > getLastSyncedAt(household.id);

      beginSync();
      setLastSyncError(null);
      try {
        const result = await pullCloudToLocal(client, household.id);
        // 端末だけの追加・更新をクラウドへ送って項目単位で揃える
        if (session?.user && isMigrationCompleted(household.id)) {
          const pushResult = await pushLocalToCloud(
            client,
            household.id,
            session.user.id,
          );
          if (pushResult.errors.length > 0) {
            setLastSyncError(pushResult.errors.join(" / "));
          }
        }
        setLastPulledAt(new Date().toISOString());
        setLastSyncedAt(household.id);
        if (options?.notify || hadLocalChanges) {
          showSyncMessage("最新のデータを同期しました");
        }
        return result;
      } catch (error) {
        setLastSyncError(toUserFacingError(error));
        return null;
      } finally {
        endSync();
      }
    },
    [household, mode, session, syncConflict, beginSync, endSync, showSyncMessage],
  );

  // 初回のみ: mode 判定と session 取得（render 中に browser API / env 差分を出さない）
  useEffect(() => {
    let mounted = true;
    const nextMode = getAppDataMode();

    const finishLocal = () => {
      queueMicrotask(() => {
        if (!mounted) {
          return;
        }
        setMode(nextMode);
        setReady(true);
      });
    };

    if (nextMode !== "supabase") {
      finishLocal();
      return;
    }

    const client = getSupabaseBrowserClient();
    if (!client) {
      finishLocal();
      return;
    }

    queueMicrotask(() => {
      if (mounted) {
        setMode(nextMode);
      }
    });

    client.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }
      setSession(data.session);
      setReady(true);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (mode !== "supabase" || !session) {
      queueMicrotask(() => {
        setProfile(null);
        setHousehold(null);
        setMembers([]);
      });
      return;
    }

    // 認証セッションに合わせて家庭情報を外部取得する
    // eslint-disable-next-line react-hooks/set-state-in-effect -- auth 同期
    void refreshFamily().catch((error) => {
      setLastSyncError(toUserFacingError(error));
    });
  }, [ready, mode, session, refreshFamily]);

  // 初回コピーダイアログ: local データあり & migrationCompleted=false のみ
  useEffect(() => {
    if (!ready || mode !== "supabase" || !household) {
      queueMicrotask(() => setNeedsMigrationPrompt(false));
      return;
    }
    queueMicrotask(() => {
      ensureMigrationGate(household.id);
      setNeedsMigrationPrompt(shouldShowInitialMigrationPrompt(household.id));
    });
  }, [ready, mode, household]);

  // 初回・家庭ID変更時: 自動同期（初回コピー待ち中はスキップ）
  useEffect(() => {
    if (!household?.id || mode !== "supabase") {
      return;
    }
    if (shouldShowInitialMigrationPrompt(household.id)) {
      return;
    }
    if (shouldSkipCloudPull()) {
      return;
    }
    const handle = window.setTimeout(() => {
      void pullLatest({ skipConflictCheck: false });
    }, 0);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- household.id
  }, [household?.id, mode]);

  // フォーカス復帰で再取得（直近の端末編集は上書きしない）
  useEffect(() => {
    if (mode !== "supabase" || !household) {
      return;
    }
    const onFocus = () => {
      if (shouldShowInitialMigrationPrompt(household.id)) {
        return;
      }
      if (shouldSkipCloudPull()) {
        return;
      }
      void pullLatest();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [household, mode, pullLatest]);

  // 端末側の変更をクラウドへ遅延プッシュ（既存 localStorage CRUD を活かす）
  useEffect(() => {
    if (mode !== "supabase" || !household || !session?.user) {
      return;
    }
    if (!isMigrationCompleted(household.id)) {
      // 初回コピー完了前は自動 push しない（破棄／コピーの選択を尊重）
      return;
    }
    const client = getSupabaseBrowserClient();
    if (!client) {
      return;
    }

    let timer: number | null = null;
    const schedulePush = (event?: Event) => {
      if (isLocalPushSuppressed()) {
        return;
      }
      if (syncConflict !== null) {
        return;
      }
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      const detail =
        event instanceof CustomEvent
          ? (event.detail as { key?: string } | undefined)
          : undefined;
      const delay = detail?.key === STORAGE_KEYS.mealPlans ? 200 : 1200;
      timer = window.setTimeout(() => {
        if (isLocalPushSuppressed() || syncConflict !== null) {
          return;
        }
        beginSync();
        void pushLocalToCloud(client, household.id, session.user.id)
          .then((result) => {
            if (result.errors.length > 0) {
              setLastSyncError(result.errors.join(" / "));
            } else {
              setLastSyncedAt(household.id);
            }
          })
          .catch((error) => {
            setLastSyncError(toUserFacingError(error));
          })
          .finally(() => {
            endSync();
          });
      }, delay);
    };

    window.addEventListener("storage", schedulePush);
    window.addEventListener(LOCAL_DATA_CHANGED_EVENT, schedulePush);
    return () => {
      window.removeEventListener("storage", schedulePush);
      window.removeEventListener(LOCAL_DATA_CHANGED_EVENT, schedulePush);
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [household, mode, session, syncConflict, beginSync, endSync]);

  const value = useMemo<FamilySessionContextValue>(() => {
    return {
      mode,
      ready,
      session,
      user: session?.user ?? null,
      profile,
      household,
      members,
      syncing,
      lastSyncError,
      lastPulledAt,
      lastSyncMessage,
      clearSyncMessage: () => setLastSyncMessage(null),
      needsMigrationPrompt,
      syncConflict,
      dismissSyncConflict: () => setSyncConflict(null),
      async signIn(email, password) {
        const client = getSupabaseBrowserClient();
        if (!client) {
          throw new Error("Supabase が設定されていません");
        }
        const { error } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          throw error;
        }
      },
      async signUp(email, password, displayName) {
        const client = getSupabaseBrowserClient();
        if (!client) {
          throw new Error("Supabase が設定されていません");
        }
        const { error } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
          },
        });
        if (error) {
          throw error;
        }
      },
      async signOut() {
        const client = getSupabaseBrowserClient();
        if (!client) {
          return;
        }
        await client.auth.signOut();
        setProfile(null);
        setHousehold(null);
        setMembers([]);
        setNeedsMigrationPrompt(false);
        setSyncConflict(null);
      },
      async createHousehold(name, displayName) {
        const client = getSupabaseBrowserClient();
        if (!client) {
          throw new Error("Supabase が設定されていません");
        }
        const repo = createSupabaseHouseholdRepository(client);
        await repo.createHousehold(name, displayName);
        await refreshFamily();
      },
      async joinHousehold(code, displayName) {
        const client = getSupabaseBrowserClient();
        if (!client) {
          throw new Error("Supabase が設定されていません");
        }
        const repo = createSupabaseHouseholdRepository(client);
        await repo.joinWithInvite(code, displayName);
        await refreshFamily();
      },
      async createInvite() {
        const client = getSupabaseBrowserClient();
        if (!client) {
          throw new Error("Supabase が設定されていません");
        }
        const repo = createSupabaseHouseholdRepository(client);
        return repo.createInvite(72);
      },
      refreshFamily,
      pullLatest,
      async migrateLocalToCloud() {
        if (!household || !session?.user) {
          return null;
        }
        const client = getSupabaseBrowserClient();
        if (!client) {
          return null;
        }
        beginSync();
        setLastSyncError(null);
        try {
          const result = await pushLocalToCloud(
            client,
            household.id,
            session.user.id,
          );
          if (result.errors.length === 0) {
            setMigrationMarker(household.id);
            markMigrationCompleted(household.id, "copied");
            setNeedsMigrationPrompt(false);
            await pullCloudToLocal(client, household.id);
            setLastPulledAt(new Date().toISOString());
            setLastSyncedAt(household.id);
          } else {
            setLastSyncError(result.errors.join(" / "));
          }
          return result;
        } catch (error) {
          setLastSyncError(toUserFacingError(error));
          return null;
        } finally {
          endSync();
        }
      },
      async discardLocalMigration() {
        if (!household) {
          return;
        }
        const client = getSupabaseBrowserClient();
        if (!client) {
          return;
        }
        markMigrationCompleted(household.id, "discarded");
        setNeedsMigrationPrompt(false);
        beginSync();
        setLastSyncError(null);
        try {
          await pullCloudToLocal(client, household.id);
          setLastPulledAt(new Date().toISOString());
          setLastSyncedAt(household.id);
        } catch (error) {
          setLastSyncError(toUserFacingError(error));
        } finally {
          endSync();
        }
      },
      async resolveSyncConflict(choice) {
        if (!household || !session?.user) {
          return;
        }
        const client = getSupabaseBrowserClient();
        if (!client) {
          return;
        }
        const conflict = syncConflict;
        setSyncConflict(null);
        beginSync();
        setLastSyncError(null);
        try {
          const preferCloudIds = new Set(
            (conflict?.items ?? []).map((item) => item.id),
          );
          if (choice === "local") {
            const result = await pushLocalToCloud(
              client,
              household.id,
              session.user.id,
            );
            if (result.errors.length > 0) {
              setLastSyncError(result.errors.join(" / "));
              if (conflict) setSyncConflict(conflict);
              return;
            }
            await pullCloudToLocal(client, household.id);
          } else if (choice === "cloud") {
            await pullCloudToLocal(client, household.id, {
              preferCloudIds,
            });
            const pushResult = await pushLocalToCloud(
              client,
              household.id,
              session.user.id,
            );
            if (pushResult.errors.length > 0) {
              setLastSyncError(pushResult.errors.join(" / "));
            }
          } else {
            // merge: 項目単位で自動結合（通常の同期と同じ）
            await pullCloudToLocal(client, household.id);
            const pushResult = await pushLocalToCloud(
              client,
              household.id,
              session.user.id,
            );
            if (pushResult.errors.length > 0) {
              setLastSyncError(pushResult.errors.join(" / "));
            }
          }
          setLastPulledAt(new Date().toISOString());
          setLastSyncedAt(household.id);
          showSyncMessage("最新のデータを同期しました");
        } catch (error) {
          setLastSyncError(toUserFacingError(error));
          if (conflict) setSyncConflict(conflict);
        } finally {
          endSync();
        }
      },
    };
  }, [
    mode,
    ready,
    session,
    profile,
    household,
    members,
    syncing,
    lastSyncError,
    lastPulledAt,
    lastSyncMessage,
    needsMigrationPrompt,
    syncConflict,
    refreshFamily,
    pullLatest,
    beginSync,
    endSync,
    showSyncMessage,
  ]);

  return (
    <FamilySessionContext.Provider value={value}>
      {children}
    </FamilySessionContext.Provider>
  );
}

export function useFamilySession(): FamilySessionContextValue {
  const ctx = useContext(FamilySessionContext);
  if (!ctx) {
    throw new Error("useFamilySession は FamilySessionProvider 内で使ってください");
  }
  return ctx;
}
