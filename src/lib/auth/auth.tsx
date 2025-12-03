import { dataEnv } from "@/lib/data/DataEnvironment";
import { useProfileStore } from "@/lib/data/hooks/useProfileStore";
import { supabase } from "@/lib/supabase/supabaseClient";
import { ProfileConflictError } from "@/lib/utils/errors";
import type { Session } from "@supabase/supabase-js";
import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";

/* ------------------------------------------------------------
   1. Define Auth Context Shape
------------------------------------------------------------- */
type AuthContextType = {
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithMagicLink: async () => ({ error: null }),
  signOut: async () => {},
});

/* ------------------------------------------------------------
   2. Redirect URL Helper (Expo SDK 50+)
------------------------------------------------------------- */
function getRedirectUrl() {
  const env = Constants.executionEnvironment;

  // Web MUST use an https callback (no custom schemes in browsers)
  if (Platform.OS === "web") {
    return `${window.location.origin}/auth/v1/callback`;
  }

  // Expo Go → Expo automatically handles proxy redirects
  if (env === "storeClient") {
    return AuthSession.makeRedirectUri({
      path: "auth/callback",
      preferLocalhost: true,
    });
  }

  // EAS Dev Build or Production Build → use your custom scheme
  return AuthSession.makeRedirectUri({
    scheme: "rallyhub",
    path: "auth/callback",
    preferLocalhost: false,
  });
}

/* ------------------------------------------------------------
   3. AuthProvider Component
------------------------------------------------------------- */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const syncInProgressRef = useRef(false);
  const initialSyncDoneRef = useRef(false);

  // Trigger sync when user is signed in to ensure known player list is downloaded
  const triggerSyncForUser = async (userId: string, markInitialSyncDone: boolean = false) => {
    // Prevent concurrent syncs
    if (syncInProgressRef.current) {
      console.log("[auth] Sync already in progress, skipping");
      return;
    }

    syncInProgressRef.current = true;
    try {
      console.log("[auth] Triggering sync for user:", userId);
      await dataEnv.syncService.syncAll(userId);
      console.log("[auth] Sync completed for user:", userId);
      
      // Refresh the profile store so UI components show updated profile data
      // This ensures the user is recognized as "registered" immediately after sign-in
      await useProfileStore.getState().refresh();
      console.log("[auth] Profile store refreshed after sync");
      
      // Only mark initial sync done after successful completion
      if (markInitialSyncDone) {
        initialSyncDoneRef.current = true;
      }
    } catch (err) {
      // Handle profile conflict error by signing out and showing an alert
      if (err instanceof ProfileConflictError) {
        console.warn("[auth] Profile conflict detected, signing out user");
        await supabase.auth.signOut();
        Alert.alert(
          "Profile Conflict",
          "You already have a profile associated to your identity. Please sign in from a device that does not have a local profile, or reset your local profile."
        );
        return;
      }
      console.error("[auth] Error syncing for user:", err);
    } finally {
      syncInProgressRef.current = false;
    }
  };

  // Load initial session
  useEffect(() => {
    async function loadSession() {
      try {
        const { data } = await supabase.auth.getSession();
        console.log("[auth] Initial session load:", data.session);
        setSession(data.session ?? null);
        
        // If user is already signed in, trigger sync immediately
        if (data.session?.user?.id) {
          triggerSyncForUser(data.session.user.id, true);
        }
      } catch (err) {
        console.error("[auth] Error loading initial session:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSession();

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log("[auth] onAuthStateChange event:", event, newSession);
      setSession(newSession ?? null);
      
      // Trigger sync only on SIGNED_IN event (not TOKEN_REFRESHED which happens frequently)
      // Skip if initial sync was already triggered or completed to avoid race condition.
      // Note: concurrent sync calls are also prevented by syncInProgressRef check in triggerSyncForUser
      if (event === "SIGNED_IN" && newSession?.user?.id && !initialSyncDoneRef.current) {
        triggerSyncForUser(newSession.user.id, true);
      }
      // Reset flags when user signs out so sync triggers on next sign in
      if (event === "SIGNED_OUT") {
        initialSyncDoneRef.current = false;
        syncInProgressRef.current = false;
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  /* ------------------------------------------------------------
     3b. Handle deep link URLs for magic link auth (native only)
     
     On Android, when clicking a magic link, the URL with tokens
     needs to be processed at the app root level because expo-router
     may consume the URL before the callback component mounts.
  ------------------------------------------------------------- */
  useEffect(() => {
    if (Platform.OS === "web") {
      // On web, Supabase's detectSessionInUrl handles this automatically
      return;
    }

    const processedUrlsRef = { current: new Set<string>() };

    async function handleDeepLinkUrl(url: string) {
      // Prevent duplicate processing of the same URL
      if (processedUrlsRef.current.has(url)) {
        console.log("[auth] URL already processed, skipping:", url);
        return;
      }

      // Only process URLs that contain our auth callback path
      if (!url.includes("auth/callback") && !url.includes("auth/v1/callback")) {
        return;
      }

      console.log("[auth] Processing deep link URL for auth:", url);
      processedUrlsRef.current.add(url);

      // Extract tokens from URL
      const { access_token, refresh_token } = extractTokensFromDeepLink(url);

      if (access_token && refresh_token) {
        console.log("[auth] Found tokens in deep link, setting session");
        try {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) {
            console.error("[auth] Error setting session from deep link:", error);
          } else {
            console.log("[auth] Session set successfully from deep link");
          }
        } catch (err) {
          console.error("[auth] Exception setting session from deep link:", err);
        }
      } else {
        console.log("[auth] No tokens found in deep link URL");
      }
    }

    // Check initial URL when app launches via deep link
    async function checkInitialUrl() {
      try {
        const initialUrl = await Linking.getInitialURL();
        console.log("[auth] Initial deep link URL:", initialUrl);
        if (initialUrl) {
          await handleDeepLinkUrl(initialUrl);
        }
      } catch (err) {
        console.error("[auth] Error getting initial URL:", err);
      }
    }

    // Listen for URL events when app is already running
    const subscription = Linking.addEventListener("url", (event) => {
      console.log("[auth] Received deep link URL event:", event.url);
      handleDeepLinkUrl(event.url);
    });

    checkInitialUrl();

    return () => {
      subscription.remove();
    };
  }, []);

  /**
   * Extract tokens from deep link URL hash fragment or query string.
   * Used for processing magic link callbacks on native platforms.
   */
  function extractTokensFromDeepLink(url: string): { access_token?: string; refresh_token?: string } {
    const result: { access_token?: string; refresh_token?: string } = {};
    
    // Try hash fragment first (e.g., #access_token=...&refresh_token=...)
    const hashIndex = url.indexOf("#");
    if (hashIndex !== -1) {
      const hashParams = new URLSearchParams(url.substring(hashIndex + 1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken) result.access_token = accessToken;
      if (refreshToken) result.refresh_token = refreshToken;
    }
    
    // Fall back to query params if no tokens found in hash
    if (!result.access_token) {
      const queryIndex = url.indexOf("?");
      if (queryIndex !== -1) {
        const queryString = url.substring(queryIndex + 1);
        const queryWithoutHash = queryString.split("#")[0];
        const queryParams = new URLSearchParams(queryWithoutHash);
        const accessToken = queryParams.get("access_token");
        const refreshToken = queryParams.get("refresh_token");
        if (accessToken) result.access_token = accessToken;
        if (refreshToken) result.refresh_token = refreshToken;
      }
    }
    
    return result;
  }

  /* ------------------------------------------------------------
     4. Google Sign-In Handler (Supabase OAuth)
  ------------------------------------------------------------- */
  const signInWithGoogle = async () => {
    const redirectTo = getRedirectUrl();
    // Diagnostic: dump localStorage keys that may contain PKCE/code_verifier data
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const allKeys = Object.keys(window.localStorage);
        const supaKeys = allKeys.filter((k) => /supabase|sb-|supabase.auth|sb:/.test(k));
        console.log("[auth] localStorage keys before signInWithOAuth:", supaKeys);
        // Log first 20 keys/values to avoid huge output
        supaKeys.slice(0, 20).forEach((k) => {
          try {
            console.log("[auth] localStorage ->", k, window.localStorage.getItem(k));
          } catch (e) {
            console.warn("[auth] unable to read localStorage key", k, e);
          }
        });
      }
    } catch (e) {
      console.warn("[auth] error reading localStorage before sign-in", e);
    }

    try {
      // On web, skipBrowserRedirect is false by default - the browser handles redirect
      // On native, we need to get the URL and open it manually with expo-web-browser
      const skipBrowserRedirect = Platform.OS !== "web";
      
      const result = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect,
        },
      });

      console.log("[auth] signInWithOAuth result:", result);
      
      // On native platforms, open the OAuth URL in an in-app browser
      if (skipBrowserRedirect && result.data?.url) {
        console.log("[auth] Opening OAuth URL in browser:", result.data.url);
        
        let browserResult;
        try {
          browserResult = await WebBrowser.openAuthSessionAsync(
            result.data.url,
            redirectTo
          );
        } catch (browserError) {
          console.error("[auth] WebBrowser error:", browserError);
          return;
        }
        
        console.log("[auth] WebBrowser result:", browserResult);
        
        // Handle user cancellation or dismissal
        if (browserResult.type === "cancel" || browserResult.type === "dismiss") {
          console.log("[auth] User cancelled or dismissed the auth flow");
          return;
        }
        
        // If the browser session returned a URL with tokens, extract and set them
        if (browserResult.type === "success" && browserResult.url) {
          const { access_token, refresh_token } = extractTokensFromUrl(browserResult.url);
          // Supabase setSession requires both tokens for a valid session
          if (access_token && refresh_token) {
            console.log("[auth] Setting session from browser callback");
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (error) {
              console.error("[auth] Error setting session:", error);
            }
          } else if (access_token) {
            // If only access_token is present, log it but note that Supabase requires both
            console.warn("[auth] Only access_token found, missing refresh_token. Session cannot be set.");
          } else {
            console.log("[auth] No tokens found in callback URL");
          }
        }
      }
    } catch (err) {
      console.error("[auth] signInWithOAuth threw:", err);
    }

    console.log("Redirecting to:", redirectTo);
  };
  
  /**
   * Parse URL hash fragment or query string to extract OAuth auth tokens.
   * 
   * Supabase OAuth callbacks typically include tokens in the URL hash fragment
   * (e.g., rallyhub://auth/callback#access_token=...&refresh_token=...) but may
   * also use query parameters in some configurations.
   * 
   * @param url - The callback URL containing auth tokens
   * @returns Object with access_token and/or refresh_token if found, or empty object if not present
   * 
   * Priority: Hash fragment tokens take precedence over query parameter tokens
   */
  function extractTokensFromUrl(url: string): { access_token?: string; refresh_token?: string } {
    const result: { access_token?: string; refresh_token?: string } = {};
    
    // Try hash fragment first (e.g., #access_token=...&refresh_token=...)
    const hashIndex = url.indexOf("#");
    if (hashIndex !== -1) {
      const hashParams = new URLSearchParams(url.substring(hashIndex + 1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken) result.access_token = accessToken;
      if (refreshToken) result.refresh_token = refreshToken;
    }
    
    // Fall back to query params if no tokens found in hash
    if (!result.access_token && !result.refresh_token) {
      const queryIndex = url.indexOf("?");
      if (queryIndex !== -1) {
        // Extract query string, removing any hash fragment that may follow
        const queryString = url.substring(queryIndex + 1);
        const queryWithoutHash = queryString.split("#")[0];
        const queryParams = new URLSearchParams(queryWithoutHash);
        const accessToken = queryParams.get("access_token");
        const refreshToken = queryParams.get("refresh_token");
        if (accessToken) result.access_token = accessToken;
        if (refreshToken) result.refresh_token = refreshToken;
      }
    }
    
    return result;
  }

  /* ------------------------------------------------------------
     5. Email Magic Link Sign-In Handler
  ------------------------------------------------------------- */
  const signInWithMagicLink = async (email: string) => {
    const redirectTo = getRedirectUrl();
    
    try {
      console.log("[auth] Sending magic link to:", email, "with redirectTo:", redirectTo);
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        console.error("[auth] signInWithOtp error:", error);
        return { error };
      }

      console.log("[auth] Magic link sent successfully to:", email);
      return { error: null };
    } catch (err) {
      console.error("[auth] signInWithOtp threw:", err);
      return { error: err as Error };
    }
  };

  /* ------------------------------------------------------------
     6. Sign Out
  ------------------------------------------------------------- */
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, loading, signInWithGoogle, signInWithMagicLink, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* ------------------------------------------------------------
   7. Hook to access Auth Context
------------------------------------------------------------- */
export function useAuth() {
  return useContext(AuthContext);
}
