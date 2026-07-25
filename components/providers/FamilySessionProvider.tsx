"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createSupabaseHouseholdRepository } from "@/lib/repositories/supabase/household-repository";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getAppDataMode, type AppDataMode } from "@/lib/supabase/env";
import { toUserFacingError } from "@/lib/supabase/errors";
import { LOCAL_DATA_CHANGED_EVENT, STORAGE_KEYS } from "@/lib/storage";
import {
  getMigrationMarker,
  hasLocalDataToMigrate,
  isLocalPushSuppressed,
  pullCloudToLocal,
  pushLocalToCloud,
  setMigrationMarker,
  shouldSkipCloudPull,
  type PullResult,
  type PushResult,
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
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  createHousehold: (name: string, displayName: string) => Promise<void>;
  joinHousehold: (code: string, displayName?: string) => Promise<void>;
  createInvite: () => Promise<HouseholdInvite>;
  refreshFamily: () => Promise<void>;
  pullLatest: () => Promise<PullResult | null>;
  migrateLocalToCloud: () => Promise<PushResult | null>;
  needsMigrationPrompt: boolean;
  dismissMigrationPrompt: () => void;
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
  const [migrationDismissed, setMigrationDismissed] = useState(false);
  const [needsMigrationPrompt, setNeedsMigrationPrompt] = useState(false);

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
  }, [mode]);

  const pullLatest = useCallback(async () => {
    if (mode !== "supabase" || !household) {
      return null;
    }
    if (shouldSkipCloudPull()) {
      return null;
    }
    const client = getSupabaseBrowserClient();
    if (!client) {
      return null;
    }
    setSyncing(true);
    setLastSyncError(null);
    try {
      const result = await pullCloudToLocal(client, household.id);
      setLastPulledAt(new Date().toISOString());
      return result;
    } catch (error) {
      setLastSyncError(toUserFacingError(error));
      return null;
    } finally {
      setSyncing(false);
    }
  }, [household, mode]);

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

  // localStorage 参照は render ではなく effect で行い、SSR 差分を防ぐ
  useEffect(() => {
    if (
      !ready ||
      mode !== "supabase" ||
      !household ||
      migrationDismissed
    ) {
      queueMicrotask(() => setNeedsMigrationPrompt(false));
      return;
    }
    queueMicrotask(() => {
      setNeedsMigrationPrompt(
        hasLocalDataToMigrate() &&
          getMigrationMarker()?.householdId !== household.id,
      );
    });
  }, [ready, mode, household, migrationDismissed]);

  // 初回・家庭ID変更時のみクラウドから取得（pullLatest の参照変化では再実行しない）
  useEffect(() => {
    if (!household?.id || mode !== "supabase") {
      return;
    }
    if (shouldSkipCloudPull()) {
      return;
    }
    const handle = window.setTimeout(() => {
      void pullLatest();
    }, 0);
    return () => window.clearTimeout(handle);
    // household.id のみ。オブジェクト参照や pullLatest 再生成での不要な再 pull を防ぐ
    // eslint-disable-next-line react-hooks/exhaustive-deps -- household.id
  }, [household?.id, mode]);

  // フォーカス復帰で再取得（直近の端末編集は上書きしない）
  useEffect(() => {
    if (mode !== "supabase" || !household) {
      return;
    }
    const onFocus = () => {
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
    const client = getSupabaseBrowserClient();
    if (!client) {
      return;
    }

    let timer: number | null = null;
    const schedulePush = (event?: Event) => {
      if (isLocalPushSuppressed()) {
        return;
      }
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      const detail =
        event instanceof CustomEvent
          ? (event.detail as { key?: string } | undefined)
          : undefined;
      // 献立クリアなどがすぐクラウドへ届くよう、mealPlans は短めに待つ
      const delay = detail?.key === STORAGE_KEYS.mealPlans ? 200 : 1200;
      timer = window.setTimeout(() => {
        if (isLocalPushSuppressed()) {
          return;
        }
        void pushLocalToCloud(client, household.id, session.user.id).catch(
          (error) => {
            setLastSyncError(toUserFacingError(error));
          },
        );
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
  }, [household, mode, session]);

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
      needsMigrationPrompt,
      dismissMigrationPrompt: () => setMigrationDismissed(true),
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
        setSyncing(true);
        setLastSyncError(null);
        try {
          const result = await pushLocalToCloud(
            client,
            household.id,
            session.user.id,
          );
          if (result.errors.length === 0) {
            setMigrationMarker(household.id);
            await pullCloudToLocal(client, household.id);
            setLastPulledAt(new Date().toISOString());
          } else {
            setLastSyncError(result.errors.join(" / "));
          }
          return result;
        } catch (error) {
          setLastSyncError(toUserFacingError(error));
          return null;
        } finally {
          setSyncing(false);
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
    needsMigrationPrompt,
    refreshFamily,
    pullLatest,
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
