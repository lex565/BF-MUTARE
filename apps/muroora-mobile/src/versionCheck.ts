import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { API_BASE } from './mobileApi';

/**
 * Ask the server whether this build is still allowed to run.
 *
 * WHY THIS MATTERS MORE THAN IT SOUNDS. Every APK before 0.2.0 contains an
 * authentication bypass - the account screen opened without a password and
 * showed a real merchant workspace to whoever was holding the phone. Those
 * builds are still installed on testers' phones and still work, because the
 * link was pasted into messages and nothing could revoke it.
 *
 * The Control Center can now BLOCK a release, but until this call existed that
 * only stopped new downloads. A phone that already had the build carried on
 * regardless. This is what makes blocking mean something.
 *
 * PUBLIC AND UNAUTHENTICATED ON PURPOSE. A blocked build has to be told to stop
 * BEFORE anybody signs in - the bypass build's whole problem was that it let
 * people in, so putting the warning behind a login would be exactly backwards.
 *
 * IT FAILS OPEN. No network, a server hiccup, a bad response - the app carries
 * on. Somebody in Sakubva with two bars of signal must not be locked out of a
 * marketplace because a version endpoint timed out. The cost of failing open is
 * that a blocked build survives until the phone next gets a connection; the
 * cost of failing closed is an app that bricks itself off-network.
 */

export type VersionVerdict = {
  ok: boolean;
  updateRequired: boolean;
  updateAvailable: boolean;
  latestVersion: string | null;
  downloadUrl: string | null;
  releaseNotes: string | null;
  message: string;
};

/** What this build calls itself. Set in app.json. */
export const APP_VERSION =
  (Constants.expoConfig?.version as string | undefined) ?? '0.0.0';

const TIMEOUT_MS = 6000;

export async function checkVersion(): Promise<VersionVerdict | null> {
  const platform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';

  // A launch check that hangs is worse than no launch check: the person is
  // staring at a splash screen. Six seconds, then carry on.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `${API_BASE}/api/mobile/version?platform=${platform}&version=${encodeURIComponent(APP_VERSION)}`,
      { signal: controller.signal },
    );
    if (!response.ok) return null;
    return (await response.json()) as VersionVerdict;
  } catch {
    // Offline, slow, or the endpoint is down. Carry on - see the note above.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
