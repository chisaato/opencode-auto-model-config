// opencode-auto-model-config 插件的共享类型

/**
 * models.dev API 顶层响应（按 provider ID 索引）
 */
export interface ModelsDevData {
  [providerId: string]: ModelsDevProvider
}

/**
 * models.dev 中的 provider 条目
 */
export interface ModelsDevProvider {
  id: string
  name: string
  npm: string
  env: string[]
  api?: string
  doc?: string
  models: Record<string, ModelsDevModel>
}

/**
 * models.dev 中的单个模型条目
 */
export interface ModelsDevModel {
  id: string
  name: string
  family?: string
  attachment: boolean
  reasoning: boolean
  tool_call: boolean
  structured_output?: boolean
  temperature?: boolean
  knowledge?: string
  release_date: string
  last_updated: string
  modalities: {
    input: string[]
    output: string[]
  }
  open_weights: boolean
  cost?: ModelsDevCost
  limit: {
    context: number
    input?: number
    output: number
  }
  interleaved?: boolean | { field: string }
  status?: string
  provider?: string
  experimental?: boolean
}

export interface ModelsDevCost {
  input: number
  output: number
  cache_read?: number
  cache_write?: number
  reasoning?: number
  context_over_200k?: {
    input: number
    output: number
    cache_read?: number
  }
}

/**
 * 插件配置（来自 opencode.json 的 autoModelConfig 部分）
 */
export interface AutoModelConfig {
  /** 缓存 TTL，单位为秒（默认：86400 = 24 小时） */
  cacheTTL?: number
  /** 自定义缓存路径，null 表示使用默认路径（~/.config/opencode/models-dev.json） */
  cachePath?: string | null
  /** 映射关系：provider -> { modelId -> "modelsdev-provider/modelsdev-modelId" } */
  mapping: Record<string, Record<string, string>>
  /** 调试模式配置 */
  debug?: DebugConfig
}

/**
 * 调试模式配置
 */
export interface DebugConfig {
  /** 启用调试输出 */
  enabled: boolean
  /** 输出文件路径（默认：~/.config/opencode/expanded-config.json） */
  dumpPath?: string
  /** 仅输出变更的字段（默认：true） */
  diffOnly?: boolean
}

/**
 * 单个模型映射的解析结果
 */
export interface ResolvedModel {
  /** models.dev 中的数据源（如 "opencode-go/gpt-5.4"） */
  source: string
  /** 完整的 models.dev 模型数据 */
  modelData: ModelsDevModel
  /** 需要填充到 OpenCode 配置中的字段 */
  filledFields: string[]
  /** 警告信息（如有） */
  warning?: string
}

/**
 * 配置处理运行摘要（用于调试输出）
 */
export interface ProcessingSummary {
  plugin: string
  timestamp: string
  modelsDevCacheAge: number
  summary: {
    providersProcessed: number
    modelsFilled: number
    modelsNotFound: number
    modelsSkipped: number
    mappingsUsed: Record<string, string>
  }
  errors?: string[]
}

export type ConfigObject = Record<string, any>
