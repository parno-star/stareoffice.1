import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useInstallPrompt } from "@/hooks/use-install-prompt.ts";

/**
 * Wraps the app root to redirect ALL users to the install gate page
 * unless they are running in standalone mode (PWA installed).
 *
 * Bypassed routes: /install, /auth/callback, /verifikasi-surat
 */
const BYPASS_PATHS = ["/install", "/auth/callback", "/verifikasi-surat"];

const INSTALL_KEY = "star-eoffice-installed";

export function markInstallComplete() {
  try {
    localStorage.setItem(INSTALL_KEY, "1");
  } catch {
    // Storage not available
  }
}

export function isInstallComplete() {
  try {
    return localStorage.getItem(INSTALL_KEY) === "1";
  } catch {
    return false;
  }
}

export default function InstallGateGuard({
  children,
}: {
  children: ReactNode;
}) {
  const location = useLocation();
  const { isStandalone } = useInstallPrompt();

  // Always allow bypass paths
  const isBypassed = BYPASS_PATHS.some((p) =>
    location.pathname.startsWith(p),
  );
  if (isBypassed) return <>{children}</>;

  // Skip install gate in development mode so preview shows sign-in directly
  if (import.meta.env.DEV) return <>{children}</>;

  // Only allow access if app is running in standalone mode (actually installed)
  // Also allow if install was marked complete (handles transition from browser to PWA)
  if (isStandalone || isInstallComplete()) return <>{children}</>;

  // Otherwise redirect to install page — installation is mandatory
  return <Navigate to="/install" replace />;
}
