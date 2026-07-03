import {
  CUSTOM_SETUP_MODEL_ID,
  deleteApiKey,
  getCustomConfig,
  getModelSelection,
  setApiKey,
  setCustomProvider,
} from "@babalcode/engine";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { MaskedInput } from "../components/masked-input";
import { TextInput } from "../components/text-input";
import { ROUTES } from "../routes";
import { colors } from "../theme";

type Step = "baseURL" | "model" | "apiKey";

/**
 * `/custom` — configure an OpenAI-compatible endpoint: base URL, model id, optional API key.
 * Reached from `/model` when choosing “Set up custom endpoint”.
 */
export function CustomSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("baseURL");
  const [baseURL, setBaseURL] = useState("");
  const [modelId, setModelId] = useState("");
  const [prefillReady, setPrefillReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getCustomConfig(), getModelSelection()])
      .then(([custom, selection]) => {
        if (cancelled) return;
        if (custom?.baseURL) setBaseURL(custom.baseURL);
        if (selection.provider === "custom" && selection.model !== CUSTOM_SETUP_MODEL_ID) {
          setModelId(selection.model);
        }
      })
      .finally(() => {
        if (!cancelled) setPrefillReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const goBack = () => navigate(ROUTES.model);

  const finish = (apiKey: string) => {
    void setCustomProvider({ baseURL, model: modelId })
      .then(() => {
        if (apiKey.trim()) setApiKey("custom", apiKey.trim());
        else deleteApiKey("custom");
      })
      .then(() => navigate(-1))
      .catch(() => navigate(-1));
  };

  if (!prefillReady) {
    return (
      <box flexGrow={1} flexDirection="column" padding={1} gap={1}>
        <text fg={colors.muted}>Loading…</text>
      </box>
    );
  }

  return (
    <box flexGrow={1} flexDirection="column" padding={1} gap={1}>
      <text fg={colors.accent}>Custom model setup</text>
      {step === "baseURL" ? (
        <>
          <text fg={colors.muted}>OpenAI-compatible base URL (usually ends with /v1)</text>
          <box width={72}>
            <TextInput
              defaultValue={baseURL}
              placeholder="http://localhost:11434/v1"
              onCancel={goBack}
              onSubmit={(value) => {
                setBaseURL(value);
                setStep("model");
              }}
            />
          </box>
        </>
      ) : null}
      {step === "model" ? (
        <>
          <text fg={colors.muted}>Model id sent to the API</text>
          <box width={72}>
            <TextInput
              defaultValue={modelId}
              placeholder="llama3.2"
              onCancel={goBack}
              onSubmit={(value) => {
                setModelId(value);
                setStep("apiKey");
              }}
            />
          </box>
        </>
      ) : null}
      {step === "apiKey" ? (
        <>
          <text fg={colors.muted}>API key (optional — enter to skip)</text>
          <box width={72}>
            <MaskedInput
              allowEmpty
              placeholder="sk-… or leave empty"
              onCancel={goBack}
              onSubmit={finish}
            />
          </box>
        </>
      ) : null}
    </box>
  );
}
