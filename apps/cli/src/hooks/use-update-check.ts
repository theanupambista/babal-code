import { checkForUpdate, type UpdateInfo } from "@babalcode/engine";
import { useEffect, useState } from "react";
import { getAppVersion } from "../lib/version";

/**
 * Background npm update check on mount. Returns `null` while checking or when
 * the installed build is current / dev / offline.
 */
export function useUpdateCheck(): UpdateInfo | null {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    void checkForUpdate(getAppVersion()).then((result) => {
      if (!cancelled) setUpdate(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return update;
}
