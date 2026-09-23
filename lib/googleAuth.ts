// Types only — `import type` is erased at compile time, so it never reaches
// the native module. The runtime import is deliberately lazy; see below.
import type {
  SignInResponse,
  SignInSuccessResponse,
  NativeModuleError,
} from "@react-native-google-signin/google-signin";

/**
 * Google Sign-In.
 *
 * The client ID below is the **Web** OAuth client, not the Android one.
 * Google matches the Android client by package name + SHA-1 fingerprint, so it
 * never appears in app code — but without a webClientId the native SDK returns
 * a null idToken and the backend has nothing to verify.
 */
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

type GoogleModule = {
  GoogleSignin: {
    configure: (options: Record<string, unknown>) => void;
    hasPlayServices: (o?: { showPlayServicesUpdateDialog?: boolean }) => Promise<boolean>;
    signIn: () => Promise<SignInResponse>;
    signOut: () => Promise<unknown>;
  };
  isSuccessResponse: (r: SignInResponse) => r is SignInSuccessResponse;
  isErrorWithCode: (e: unknown) => e is NativeModuleError;
  statusCodes: Record<string, string>;
};

// `undefined` = not tried yet, `null` = unavailable in this binary.
let moduleCache: GoogleModule | null | undefined;

/**
 * Loads the native module lazily.
 *
 * Importing it at the top level throws when the app runs on a binary built
 * before the dependency was added (Expo Go, or an older dev client). That
 * throw happens during module evaluation, so it takes down every screen that
 * imports this file — which is the whole auth flow and the profile tab.
 * Requiring it behind a try/catch keeps the rest of the app running and lets
 * the UI tell the user Google needs a new build.
 */
function getModule(): GoogleModule | null {
  if (moduleCache !== undefined) return moduleCache;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    moduleCache = require("@react-native-google-signin/google-signin") as GoogleModule;
  } catch {
    moduleCache = null;
  }
  return moduleCache;
}

/** A Web client ID is configured for this build. */
export const isGoogleConfigured = Boolean(WEB_CLIENT_ID);

/** The native module is present in the running binary. */
export function isGoogleNativeAvailable(): boolean {
  return getModule() !== null;
}

/** Both of the above — what the sign-in button should gate on. */
export function isGoogleAvailable(): boolean {
  return isGoogleConfigured && isGoogleNativeAvailable();
}

let configured = false;

function ensureConfigured(mod: GoogleModule) {
  if (configured || !WEB_CLIENT_ID) return;
  mod.GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    // Only the default identity scopes — the app never reads Google user data
    // beyond the name and email already carried in the idToken.
    scopes: [],
    offlineAccess: false,
  });
  configured = true;
}

/** Raised when the user backs out of the Google sheet — never shown as an error. */
export class GoogleSignInCancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "GoogleSignInCancelled";
  }
}

export interface GoogleSignInResult {
  idToken: string;
  name: string | null;
  email: string;
  photo: string | null;
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  if (!WEB_CLIENT_ID) {
    throw new Error("Google sign-in is not configured yet.");
  }

  const mod = getModule();
  if (!mod) {
    throw new Error(
      "Google sign-in needs a new build of the app. Rebuild the dev client, or continue with email.",
    );
  }

  ensureConfigured(mod);

  try {
    // No-op on iOS; on Android it surfaces the Play Services update prompt
    // rather than failing with an opaque native error.
    await mod.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Sign out first so the account picker always appears. Without this a
    // device with a cached session silently reuses the last account, which
    // makes switching accounts impossible.
    await mod.GoogleSignin.signOut().catch(() => {});

    const response = await mod.GoogleSignin.signIn();

    if (!mod.isSuccessResponse(response)) throw new GoogleSignInCancelled();

    const { idToken, user } = response.data;
    if (!idToken) {
      // Practically always a configuration fault: a webClientId that does not
      // belong to the same Google Cloud project as the Android client.
      throw new Error(
        "Google did not return an ID token. Check that EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is a Web client from the same project.",
      );
    }

    return { idToken, name: user.name, email: user.email, photo: user.photo };
  } catch (e: unknown) {
    if (e instanceof GoogleSignInCancelled) throw e;

    if (mod.isErrorWithCode(e)) {
      switch (e.code) {
        case mod.statusCodes.SIGN_IN_CANCELLED:
          throw new GoogleSignInCancelled();
        case mod.statusCodes.IN_PROGRESS:
          throw new Error("A sign-in is already in progress.");
        case mod.statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw new Error("Google Play Services is unavailable on this device.");
      }
    }
    throw e;
  }
}

/** Clears the cached Google session. Call alongside app logout. */
export async function signOutFromGoogle(): Promise<void> {
  const mod = getModule();
  if (!mod || !WEB_CLIENT_ID) return;
  ensureConfigured(mod);
  await mod.GoogleSignin.signOut().catch(() => {});
}
