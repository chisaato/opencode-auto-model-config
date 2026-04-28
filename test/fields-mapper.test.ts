import { describe, it, expect } from "vitest"
import { fieldsFromModelsDev, getFillableFields } from "../src/utils/fields-mapper"
import type { ModelsDevModel } from "../src/types"

function makeModel(overrides: Partial<ModelsDevModel> = {}): ModelsDevModel {
  return {
    id: "gpt-4o",
    name: "GPT-4o",
    family: "gpt",
    attachment: true,
    reasoning: false,
    tool_call: true,
    structured_output: true,
    temperature: true,
    knowledge: "2023-10",
    release_date: "2024-05-13",
    last_updated: "2024-08-06",
    modalities: { input: ["text", "image"], output: ["text"] },
    open_weights: false,
    cost: { input: 2.5, output: 10, cache_read: 1.25 },
    limit: { context: 128000, output: 16384 },
    ...overrides,
  }
}

describe("fieldsFromModelsDev", () => {
  it("fills all standard fields from a complete model entry", () => {
    const result = fieldsFromModelsDev(makeModel())

    expect(result.name).toBe("GPT-4o")
    expect(result.modalities).toEqual({ input: ["text", "image"], output: ["text"] })
    expect(result.limit).toEqual({ context: 128000, output: 16384 })
    expect(result.attachment).toBe(true)
    expect(result.tool_call).toBe(true)
    expect(result.reasoning).toBeUndefined() // false = omit (default)
    expect(result.structured_output).toBe(true)
    expect(result.cost).toEqual({ input: 2.5, output: 10, cache_read: 1.25 })
    expect(result.knowledge).toBe("2023-10")
  })

  it("omits reasoning when false", () => {
    const result = fieldsFromModelsDev(makeModel({ reasoning: false }))
    expect(result.reasoning).toBeUndefined()
  })

  it("includes reasoning when true", () => {
    const result = fieldsFromModelsDev(makeModel({ reasoning: true }))
    expect(result.reasoning).toBe(true)
  })

  it("includes input limit only when different from context", () => {
    const same = fieldsFromModelsDev(makeModel({ limit: { context: 128000, output: 16384, input: 128000 } }))
    expect(same.limit!.input).toBeUndefined()

    const different = fieldsFromModelsDev(makeModel({ limit: { context: 1050000, output: 128000, input: 922000 } }))
    expect(different.limit!.input).toBe(922000)
  })

  it("handles missing cost gracefully", () => {
    const result = fieldsFromModelsDev(makeModel({ cost: undefined }))
    expect(result.cost).toBeUndefined()
  })

  it("handles interleaved field", () => {
    const withInterleaved = fieldsFromModelsDev(makeModel({ interleaved: { field: "reasoning_content" } }))
    expect(withInterleaved.interleaved).toEqual({ field: "reasoning_content" })

    const withoutInterleaved = fieldsFromModelsDev(makeModel({ interleaved: undefined }))
    expect(withoutInterleaved.interleaved).toBeUndefined()
  })

  it("handles missing knowledge", () => {
    const result = fieldsFromModelsDev(makeModel({ knowledge: undefined }))
    expect(result.knowledge).toBeUndefined()
  })
})

describe("getFillableFields", () => {
  it("returns the list of fields that can be auto-filled", () => {
    const fields = getFillableFields()
    expect(fields).toContain("name")
    expect(fields).toContain("modalities")
    expect(fields).toContain("limit")
    expect(fields).toContain("attachment")
    expect(fields).toContain("tool_call")
    expect(fields).toContain("reasoning")
    expect(fields).toContain("structured_output")
    expect(fields).toContain("cost")
    expect(fields).toContain("knowledge")
    expect(fields).toContain("interleaved")
  })
})
