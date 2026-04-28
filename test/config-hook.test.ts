import { describe, it, expect, beforeEach, afterEach } from "vitest"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { createConfigHook } from "../src/plugin/config-hook"

describe("config-hook integration", () => {
  const tmpDir = path.join(os.tmpdir(), "oc-hook-test-" + Date.now())
  const origCwd = process.cwd()

  beforeEach(async () => {
    await fs.mkdir(tmpDir, { recursive: true })
    process.chdir(tmpDir)
  })

  afterEach(async () => {
    process.chdir(origCwd)
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it("does nothing when config file is missing", async () => {
    const hook = createConfigHook()
    const config: any = { provider: { openai: { models: { "gpt-4o": {} } } } }
    await hook(config)
    expect(config.provider.openai.models["gpt-4o"]).toEqual({})
  })

  it("skips when config is frozen", async () => {
    await fs.writeFile(
      path.join(tmpDir, "oc-auto-model-config.json"),
      JSON.stringify({ mapping: { test: { m: "p/m" } } }),
    )
    const hook = createConfigHook()
    const config = Object.freeze({ provider: {} })
    await hook(config)
  })

  it("does not overwrite existing fields set by user", async () => {
    let realData: any
    try {
      const raw = await fs.readFile(
        "/home/gzzchh/.config/opencode/models-dev.json",
        "utf-8",
      )
      const parsed = JSON.parse(raw)
      realData = parsed.data || parsed
    } catch {
      return
    }

    if (!realData?.openai?.models?.["gpt-4o"]) return

    await fs.writeFile(
      path.join(tmpDir, "oc-auto-model-config.json"),
      JSON.stringify({ mapping: { openai: { "gpt-4o": "openai/gpt-4o" } } }),
    )

    const hook = createConfigHook()
    const config: any = {
      provider: {
        openai: {
          models: {
            "gpt-4o": { name: "My Custom Name" },
          },
        },
      },
    }

    await hook(config)

    const model = config.provider.openai.models["gpt-4o"]
    expect(model.name).toBe("My Custom Name")
    expect(model.modalities).toBeDefined()
    expect(model.limit).toBeDefined()
  })
})
