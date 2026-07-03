export type PromptContext = {
  enabledTools: ReadonlySet<string>;
  // add later: outputStyle, language, mcpClients, model, cwd...
};

export type StaticSection = {
  name: string;
  build: (ctx: PromptContext) => string | null;
};

/** Internal assembly format — join before passing to the API. */
export type SystemPrompt = string[];
