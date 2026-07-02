import { DEFAULT_PROVIDER, PROVIDERS, setApiKey } from "@babalcode/engine";
import { useNavigate } from "react-router";
import { MaskedInput } from "../components/masked-input";
import { ROUTES } from "../routes";
import { colors } from "../theme";

/**
 * `/login` — enter the provider's API key via a masked field and store it in the
 * OS keychain. Also the first-run screen when no key is resolvable (see the boot
 * routing in `router.tsx`).
 *
 * Single provider for now, so there's no provider picker yet — it's keyed by
 * `DEFAULT_PROVIDER` and a `<select>` slots in above the field once there are more.
 */
export function Login() {
  const navigate = useNavigate();
  const provider = PROVIDERS[DEFAULT_PROVIDER];

  const handleSubmit = (key: string) => {
    setApiKey(DEFAULT_PROVIDER, key);
    // Go home rather than back: on first run there is no prior screen.
    navigate(ROUTES.home);
  };

  return (
    <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center" gap={1}>
      <text fg={colors.accent}>Set your {provider.label} API key</text>
      <text fg={colors.muted}>Stored securely in your OS keychain — never written to disk.</text>
      <box width={64}>
        <MaskedInput
          onSubmit={handleSubmit}
          onCancel={() => navigate(ROUTES.home)}
          placeholder="Paste your API key…"
        />
      </box>
    </box>
  );
}
