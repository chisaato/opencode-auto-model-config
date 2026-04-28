import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { createConfigHook } from "./config-hook"

export const AutoModelConfigPlugin: Plugin = async (_input: PluginInput) => {
  console.log("[auto-model-config] Plugin initialized")

  return {
    config: createConfigHook(),
  }
}
