import type { Config } from "@opencode-ai/plugin"
import { ModelsDevCache } from "../cache/models-dev-cache"
import { loadConfig, getMappedProviders } from "../mapping/parser"
import { resolveProviderModels } from "../mapping/resolver"
import { fieldsFromModelsDev } from "../utils/fields-mapper"
import { ConfigDumper } from "../debug/config-dumper"
import type { AutoModelConfig, ResolvedModel } from "../types"

export function createConfigHook() {
  return async (config: Config) => {
    const pluginConfig = await loadConfig()
    if (!pluginConfig) return

    if (Object.isFrozen?.(config) || Object.isSealed?.(config)) {
      console.warn("[auto-model-config] Config object is frozen/sealed, cannot modify")
      return
    }

    const cache = new ModelsDevCache({
      cachePath: pluginConfig.cachePath ?? undefined,
      cacheTTL: pluginConfig.cacheTTL,
    })

    let modelsDev
    try {
      modelsDev = await cache.get()
    } catch (error) {
      console.error(
        "[auto-model-config] Failed to load models.dev data:",
        error instanceof Error ? error.message : String(error),
      )
      return
    }

    if (!modelsDev) {
      console.warn("[auto-model-config] No models.dev data available")
      return
    }

    const cacheAge = await cache.getAge()
    const providers = getMappedProviders(pluginConfig)

    const debugConfig = pluginConfig.debug
    const dumper = debugConfig?.enabled ? new ConfigDumper(debugConfig) : null
    const snapshot = dumper ? dumper.snapshot(config as Record<string, any>) : null

    const allResolved = new Map<string, Map<string, ResolvedModel>>()

    for (const providerName of providers) {
      if (!config.provider || !config.provider[providerName]) {
        if (debugConfig?.enabled) {
          console.warn(
            `[auto-model-config] Provider "${providerName}" not found in config, skipping`,
          )
        }
        continue
      }

      const resolved = resolveProviderModels(modelsDev, pluginConfig, providerName)
      allResolved.set(providerName, resolved)

      fillProviderModels(config, providerName, resolved)
    }

    if (dumper && snapshot) {
      await dumper.dump(snapshot, config as Record<string, any>, allResolved, cacheAge)
    }

    const totalFilled = [...allResolved.values()].reduce(
      (sum, m) =>
        sum + [...m.values()].filter((r) => !r.warning && r.filledFields.length > 0).length,
      0,
    )
    const totalNotFound = [...allResolved.values()].reduce(
      (sum, m) => sum + [...m.values()].filter((r) => !!r.warning).length,
      0,
    )

    if (totalFilled > 0) {
      console.log(`[auto-model-config] Filled metadata for ${totalFilled} model(s)`)
    }
    if (totalNotFound > 0) {
      console.warn(`[auto-model-config] ${totalNotFound} model(s) not found in models.dev`)
    }
  }
}

function fillProviderModels(
  config: Config,
  providerName: string,
  resolvedModels: Map<string, ResolvedModel>,
): void {
  const provider = config.provider?.[providerName]
  if (!provider) return

  if (!provider.models) {
    provider.models = {}
  }

  for (const [modelId, resolved] of resolvedModels) {
    if (resolved.warning) {
      console.warn(`[auto-model-config] Skipping ${modelId}: ${resolved.warning}`)
      continue
    }

    const existingModel = provider.models[modelId]
    const filledFields = fieldsFromModelsDev(resolved.modelData)

    if (existingModel && typeof existingModel === "object") {
      const model = existingModel as Record<string, any>
      for (const [key, value] of Object.entries(filledFields)) {
        if (!(key in model)) {
          model[key] = value
        }
      }
    } else {
      provider.models[modelId] = filledFields
    }
  }
}
