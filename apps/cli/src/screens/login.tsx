import { getModelSelection, PROVIDERS, setApiKey } from "@babalcode/engine";
import type { ProviderId } from "@babalcode/engine";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { MaskedInput } from "../components/masked-input";
import { ROUTES } from "../routes";
import { colors } from "../theme";

/**
 * `/login` — enter the API key for the *currently selected* provider via a masked
 * field and store it in the OS keychain. Also the first-run screen when no key is
 * resolvable (see the boot routing in `router.tsx`), where the selection is still the
 * default provider. The key is namespaced per provider, so switching model via
 * `/models` and re-running `/login` sets the key for that provider.
 */
export function Login() {
  const navigate = useNavigate();
  const [providerId, setProviderId] = useState<ProviderId>("google");

  useEffect(() => {
    let cancelled = false;
    void getModelSelection()
      .then((selection) => {
        if (!cancelled) setProviderId(selection.provider);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const provider = PROVIDERS[providerId];
  const apiKeyOptional = provider.requiresApiKey === false;

  const handleSubmit = (key: string) => {
    if (key.trim()) setApiKey(providerId, key);
    navigate(ROUTES.home);
  };

  return (
    <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center" gap={1}>
      <text fg={colors.accent}>Set your {provider.label} API key</text>
      {apiKeyOptional ? (
        <text fg={colors.muted}>
          API key optional · submit empty to skip · env: {provider.envVar}
        </text>
      ) : (
        <text fg={colors.muted}>Uses the {provider.envVar} key · stored in your OS keychain, never on disk.</text>
      )}
      <box width={64}>
        <MaskedInput
          onSubmit={handleSubmit}
          onCancel={() => navigate(ROUTES.home)}
          placeholder={apiKeyOptional ? "Paste API key or leave empty…" : "Paste your API key…"}
        />
      </box>
    </box>
  );
}
