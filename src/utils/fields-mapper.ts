import type { ModelsDevModel } from "../types"

/**
 * 将 models.dev 的模型条目映射为 OpenCode 模型配置对象。
 * 仅填充在 OpenCode 配置模式中有意义的字段。
 */
export function fieldsFromModelsDev(model: ModelsDevModel): Record<string, any> {
  const result: Record<string, any> = {}

  // 名称（始终填充）
  result.name = model.name

  // 模态
  result.modalities = {
    input: [...model.modalities.input],
    output: [...model.modalities.output],
  }

  // 限制（上下文窗口 + 输出）
  result.limit = {
    context: model.limit.context,
    output: model.limit.output,
  }
  // 仅在定义了输入限制且与上下文限制不同时包含
  if (model.limit.input !== undefined && model.limit.input !== model.limit.context) {
    result.limit.input = model.limit.input
  }

  // 附件支持
  result.attachment = model.attachment

  // 能力
  if (model.tool_call) {
    result.tool_call = true
  }
  if (model.reasoning) {
    result.reasoning = true
  }
  if (model.structured_output) {
    result.structured_output = true
  }

  // 费用信息（每百万 token，美元）
  if (model.cost) {
    result.cost = {
      input: model.cost.input,
      output: model.cost.output,
    }
    if (model.cost.cache_read !== undefined) {
      result.cost.cache_read = model.cost.cache_read
    }
    if (model.cost.cache_write !== undefined) {
      result.cost.cache_write = model.cost.cache_write
    }
    if (model.cost.reasoning !== undefined) {
      result.cost.reasoning = model.cost.reasoning
    }
  }

  // 知识截止日期
  if (model.knowledge) {
    result.knowledge = model.knowledge
  }

  // 交错输出（推理模型标记）
  if (model.interleaved) {
    result.interleaved = model.interleaved
  }

  return result
}

/**
 * 确定 fieldsFromModelsDev 会设置哪些字段。
 * 用于在调试模式下跟踪已填充的字段。
 */
export function getFillableFields(): string[] {
  return [
    "name",
    "modalities",
    "limit",
    "attachment",
    "tool_call",
    "reasoning",
    "structured_output",
    "cost",
    "knowledge",
    "interleaved",
  ]
}
