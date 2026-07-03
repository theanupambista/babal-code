import type { PromptContext, StaticSection, SystemPrompt } from "./types";
import { DYNAMIC_BOUNDARY } from "./boundary";
import { buildIdentitySection } from "./sections/identity";
import { buildSystemSection } from "./sections/system";
import { buildDoingTasksSection } from "./sections/doing-tasks";
import { buildActionsSection } from "./sections/actions";
import { buildUsingToolsSection } from "./sections/using-tools";
import { buildToneAndStyleSection } from "./sections/tone-and-style";
import { buildOutputEfficiencySection } from "./sections/output-efficiency";

/** Explicit assembly order — the contract for static prompt sections. */
const STATIC_SECTIONS: StaticSection[] = [
  { name: "identity", build: () => buildIdentitySection() },
  { name: "system", build: () => buildSystemSection() },
  { name: "doing_tasks", build: () => buildDoingTasksSection() },
  { name: "actions", build: () => buildActionsSection() },
  { name: "using_tools", build: (ctx) => buildUsingToolsSection(ctx) },
  { name: "tone_style", build: () => buildToneAndStyleSection() },
  { name: "output_efficiency", build: () => buildOutputEfficiencySection() },
];

export function buildStaticSystemPrompt(ctx: PromptContext): SystemPrompt {
  return STATIC_SECTIONS.map((s) => s.build(ctx)).filter(
    (s): s is string => s !== null && s.length > 0,
  );
}

/** Assembles static + dynamic sections. Dynamic registry plugs in after the boundary. */
export function buildSystemPrompt(ctx: PromptContext): SystemPrompt {
  const staticParts = buildStaticSystemPrompt(ctx);
  return [
    ...staticParts,
    DYNAMIC_BOUNDARY,
    // Phase 2: ...resolveDynamicSections(dynamicRegistry, ctx)
  ].filter((s) => s !== DYNAMIC_BOUNDARY || process.env.ENABLE_PROMPT_CACHE === "1");
}
