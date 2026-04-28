# opencode-auto-model-config 设计文档

## 1. 动机

用户在 OpenCode 中配置自定义 provider（如 NewAPI 转发站、自建网关等）时，需要手动为每个模型填写 name、limit、modalities、cost 等元数据。这些数据在 [models.dev](https://models.dev) 中已经完整收录。

本插件让用户只需在配置中声明模型 ID 到 models.dev 条目的映射，即可自动填充所有元数据。

## 2. 数据来源

- **API**: `https://models.dev/api.json`（~1.8MB，116 个 provider，4357 个模型，每百万 token 美元定价）
- **缓存**: 首次下载后写入本地文件缓存，默认 TTL 24 小时
- **现有缓存**: 用户 `/home/gzzchh/.config/opencode/models-dev.json` 已有 116 provider 的完整数据

### 2.1 models.dev 数据结构

```
api.json (dict, keyed by provider ID)
├── openai (provider)
│   ├── id: "openai"
│   ├── npm: "@ai-sdk/openai"
│   ├── name: "OpenAI"
│   ├── env: ["OPENAI_API_KEY"]
│   ├── api: null
│   ├── doc: "https://..."
│   └── models (dict, keyed by model ID)
│       ├── gpt-4o
│       │   ├── name: "GPT-4o"
│       │   ├── cost: { input: 2.5, output: 10, cache_read: 1.25 }
│       │   ├── limit: { context: 128000, output: 16384 }
│       │   ├── modalities: { input: ["text","image"], output: ["text"] }
│       │   ├── tool_call: true
│       │   ├── reasoning: false
│       │   ├── structured_output: true
│       │   ├── knowledge: "2023-10"
│       │   └── ...
│       └── ...
├── opencode-go (provider)
│   ├── id: "opencode-go"
│   ├── npm: "@ai-sdk/openai-compatible"
│   ├── api: "https://api.opencode.ai"
│   └── models
│       ├── gpt-5.4      ← 同名模型，元数据可能与 openai/gpt-5.4 不同
│       ├── minimax-m2.7
│       └── ...
└── ...
```

### 2.2 Model 条目字段覆盖度

| 字段 | 覆盖率 | 类型 | 说明 |
|------|--------|------|------|
| `id` | 100% | string | 模型 ID |
| `name` | 100% | string | 显示名称 |
| `cost.input` | 95% | number | 每百万输入 token 成本 |
| `cost.output` | 95% | number | 每百万输出 token 成本 |
| `cost.cache_read` | — | number | 缓存读取成本 |
| `limit.context` | 100% | number | 上下文窗口 |
| `limit.output` | 100% | number | 最大输出 |
| `modalities` | 100% | object | 输入/输出模态 |
| `tool_call` | 100% | boolean | function calling 支持 |
| `reasoning` | 100% | boolean | 思维链支持 |
| `structured_output` | 41.6% | boolean | 结构化输出 |
| `knowledge` | 49.7% | string | 知识截止日期 |
| `attachment` | 100% | boolean | 附件支持 |
| `interleaved` | 8.6% | boolean/object | 交错推理 |

## 3. 插件架构

### 3.1 插件入口

```typescript
// src/index.ts
import type { Plugin, PluginInput } from "@opencode-ai/plugin"

export const AutoModelConfigPlugin: Plugin = async (input: PluginInput) => {
  return {
    config: createConfigHook(input.client),
  }
}
```

### 3.2 Config Hook 工作流

```
1. 搜索并读取 oc-auto-model-config.json
   ├── ~/.config/opencode/oc-auto-model-config.json
   └── ./oc-auto-model-config.json (工作目录)
2. 读取本地缓存（~/.opencode/models-dev.json）
   ├── 不存在或过期 → 下载 api.json → 写入缓存
   └── 有效 → 使用缓存
3. 遍历 config.provider，找到 mapping 中声明的 provider
4. 对每个映射：user-model-id → "modelsdev-provider/modelsdev-model-id"
   a. 解析 target: { provider, modelId }
   b. 在缓存中查找 models[provider].models[modelId]
   c. 构建 OpenCode 模型配置字段
   d. 合并到 config.provider[userProvider].models[userModelId]
5. 返回增强后的 config
```

### 3.3 模块划分

```
src/
├── index.ts                  # 插件入口
├── plugin/
│   ├── index.ts              # 创建 hooks
│   └── config-hook.ts        # config hook：核心逻辑
├── cache/
│   └── models-dev-cache.ts   # 文件缓存管理（下载、TTL、失效）
├── mapping/
│   ├── parser.ts             # 解析 mapping 配置
│   └── resolver.ts           # 根据映射解析 models.dev→OpenCode 字段
├── debug/
│   └── config-dumper.ts      # 调试模式：dump 增强后配置供审查
└── utils/
    └── fields-mapper.ts      # models.dev 字段 → OpenCode 配置字段的映射
```

## 4. 配置格式设计

### 4.1 用户配置

插件不修改 opencode.json。所有映射关系写在独立配置文件 `oc-auto-model-config.json` 中，放在 `~/.config/opencode/` 或项目根目录。

#### opencode.json（仅声明 provider + 模型 ID）

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-auto-model-config@latest"],
  "provider": {
    "misaka-newapi": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "MisakaAPI",
      "options": {
        "baseURL": "https://oi.misakacloud.dev/v1"
      },
      "models": {
        "gpt-5.4": {},           // 只需空对象，插件自动填充
        "gpt-5.4-mini": {},
        "gpt-5.3-codex-spark": {},
        "minimax-m2.7": {},
        "mimo-v2-flash": {},
        "mimo-v2-pro": {},
        "mimo-v2-omni": {}
      }
    }
  }
}
```

#### oc-auto-model-config.json（插件独立配置文件）
#### oc-auto-model-config.json（插件独立配置文件）

```jsonc
{
  "cacheTTL": 86400,
  "cachePath": null,
  "mapping": {
    "misaka-newapi": {
      "gpt-5.4":           "opencode-go/gpt-5.4",
      "gpt-5.4-mini":      "opencode-go/gpt-5.4-mini",
      "gpt-5.3-codex-spark": "opencode-go/gpt-5.3-codex-spark",
      "minimax-m2.7":      "opencode-go/minimax-m2.7",
      "mimo-v2-flash":     "opencode-go/mimo-v2-flash",
      "mimo-v2-pro":       "opencode-go/mimo-v2-pro",
      "mimo-v2-omni":      "opencode-go/mimo-v2-omni"
    }
  },
  "debug": {
    "enabled": true,
    "dumpPath": "./opencode-expanded.json",
    "diffOnly": true
  }
}
```


### 4.2 映射格式

```
oc-auto-model-config.json:
{
  "mapping": {
    "<用户provider名>": {
      "<用户model ID>": "<models.dev中provider>/<models.dev中model ID>"
    }
  }
}
```

示例：
- `"gpt-5.4": "opencode-go/gpt-5.4"` → 从 `models.dev[opencode-go].models[gpt-5.4]` 获取元数据
- `"minimax-m2.7": "minimax/MiniMax-M2.7"` → 从 `models.dev[minimax].models[MiniMax-M2.7]` 获取

> **注意**: models.dev 中 model ID 的 key 可能与 `id` 字段不同（大小写敏感），匹配时需同时检查 `id` 字段和字典 key。

### 4.3 字段映射规则

| models.dev 字段 | → | OpenCode 配置字段 | 条件 |
|------------------|---|-------------------|------|
| `name` | → | `name` | 用户未设置时填充 |
| `limit.context` | → | `limit.context` | 用户未设置时填充 |
| `limit.output` | → | `limit.output` | 用户未设置时填充 |
| `limit.input` | → | `limit.input` | 存在时填充 |
| `modalities` | → | `modalities` | 用户未设置时填充 |
| `cost` | → | `cost` | 用户未设置时填充 |
| `attachment` | → | `attachment` | 用户未设置时填充 |
| `tool_call` | → | `tool_call` | 存在时填充 |
| `reasoning` | → | `reasoning` | 存在时填充 |
| `structured_output` | → | `structured_output` | 存在时填充 |
| `knowledge` | → | `knowledge` | 存在时填充 |
| `interleaved` | → | `interleaved` | 推理模型时填充 |

### 4.4 覆盖策略

- **绝不覆盖**用户已显式设置的字段
- 只填充用户模型中值为 `undefined` 或不存在（即 `{}`）的字段
- 用户的 `options`、`variants` 等字段完全保留

### 4.5 调试模式

调试模式下，插件会将增强后的配置 dump 到文件，方便用户审查映射是否匹配正确。

#### 配置

在 `oc-auto-model-config.json` 中设置 `debug` 字段：

```jsonc
{
  "mapping": { ... },
  "debug": {
    "enabled": true,
    "dumpPath": "./opencode-expanded.json",
    "diffOnly": true
  }
}
```

#### dump 输出格式

当 `diffOnly: true` 时，输出只包含被插件变更的部分 + 变更元数据：

```jsonc
{
  "_meta": {
    "plugin": "opencode-auto-model-config",
    "timestamp": "2026-04-29T01:20:00Z",
    "modelsDevCacheAge": 3600,                    // 缓存已有多久（秒）
    "summary": {
      "providersProcessed": 1,
      "modelsFilled": 7,
      "modelsNotFound": 0,
      "mappingsUsed": {
        "misaka-newapi/gpt-5.4": "opencode-go/gpt-5.4",
        "misaka-newapi/minimax-m2.7": "opencode-go/minimax-m2.7",
        // ...
      }
    }
  },
  "provider": {
    "misaka-newapi": {
      "models": {
        "gpt-5.4": {
          "_source": "opencode-go/gpt-5.4",       // ← 数据来源
          "_filled": ["name","limit","modalities","cost","attachment","tool_call","reasoning","knowledge"],
          "name": "GPT-5.4",
          "limit": { "context": 1050000, ... },
          // ... 仅显示被填充的字段
        },
        "gpt-5.4-mini": {
          "_source": "opencode-go/gpt-5.4-mini",
          "_filled": ["name","limit","modalities","cost","attachment","tool_call","reasoning","knowledge"],
          // ...
        }
      }
    }
  }
}
```

当 `diffOnly: false` 时，输出完整的最终配置（等价于 OpenCode 实际使用的配置）。

#### 工作流

```
插件处理 config 前:
  → 深拷贝原始 config 作为 baseline

插件处理 config 后:
  → 对比 baseline vs 当前 config，计算 diff
  → 写入 dump 文件
  → console.log 提示 dump 位置（仅 debug 模式）
```

## 5. 用户实际场景分析

以用户现有的 `misaka-newapi` 为例：

### 5.1 当前状态（手动填写）

```jsonc
"misaka-newapi": {
  "models": {
    "gpt-5.4": {
      "name": "GPT-5.4",
      "attachment": true,
      "limit": { "context": 1050000, "output": 128000 },
      "modalities": { "input": ["text","image"], "output": ["text"] },
      "options": { "reasoningEffort": "none" },
      "variants": { "none": {...}, "low": {...}, ... }
    },
    // ... 每个模型都要手动写 20+ 行
  }
}
```

### 5.2 使用插件后

```jsonc
"misaka-newapi": {
  "models": {
    "gpt-5.4": {},           // ← 只需这 1 行！
    "gpt-5.4-mini": {},       // ← 自动填充所有元数据
    "gpt-5.3-codex-spark": {},
    "minimax-m2.7": {},
    "mimo-v2-flash": {},
    "mimo-v2-pro": {},
    "mimo-v2-omni": {}
  }
}
```

插件处理后，`gpt-5.4` 的模型配置将自动变为：

```jsonc
"gpt-5.4": {
  "name": "GPT-5.4",                                          // 来自 opencode-go
  "attachment": true,
  "limit": { "context": 1050000, "input": 922000, "output": 128000 },
  "modalities": { "input": ["text","image","pdf"], "output": ["text"] },
  "cost": { "input": 2.5, "output": 15, "cache_read": 0.25 },
  "reasoning": true,
  "tool_call": true,
  "knowledge": "2025-08-31"
  // options / variants 如果用户需要则手动保留
}
```

## 6. 技术细节

### 6.1 依赖

```json
{
  "dependencies": {
    "@opencode-ai/plugin": "^1.4.0"
  }
}
```

- 参考 `opencode-lmstudio` 的 `@opencode-ai/plugin: ^1.0.166`
- 用户环境实际版本是 `1.4.6`，建议最低 `^1.0.0`

### 6.2 缓存机制

参考 `opencode-lmstudio` 的 `ModelStatusCache` 但改为文件持久化：

```typescript
class ModelsDevCache {
  private cachePath: string       // ~/.opencode/models-dev.json
  private ttl: number             // 毫秒

  async get(): Promise<ModelsDevData>     // 获取缓存或下载
  async download(): Promise<void>         // 强制下载
  isValid(): boolean                      // TTL 检查
  getAge(): number                        // 缓存年龄
}
```

- 下载使用 `fetch` + `AbortSignal.timeout(30000)` 超时
- 首次使用自动下载
- 可通过 `cacheTTL` 配置过期时间
- 可通过 `cachePath` 自定义路径

### 6.3 调试模式实现

#### 模块

```
src/
├── debug/
│   └── config-dumper.ts     # 配置 dump 逻辑
```

#### Config Dumper

```typescript
class ConfigDumper {
  private debugConfig: DebugConfig

  constructor(config: DebugConfig) {
    this.debugConfig = config
  }

  // 深拷贝原始 config 作为对比基线
  snapshot(original: any): any { ... }

  // 对比 snapshot 和 current，计算 diff
  diff(snapshot: any, current: any): ConfigDiff { ... }

  // 写入 dump 文件
  async dump(diff: ConfigDiff): Promise<void> {
    const content = this.debugConfig.diffOnly
      ? this.formatDiff(diff)       // 仅变更部分 + 元数据
      : this.formatFull(diff)       // 完整最终配置

    await fs.writeFile(this.debugConfig.dumpPath, JSON.stringify(content, null, 2))
    console.log(`[auto-model-config] Debug dump written to: ${this.debugConfig.dumpPath}`)
  }
}
```

#### 集成到 config hook

```typescript
const pluginConfig = await loadConfig()
const dumper = pluginConfig?.debug?.enabled ? new ConfigDumper(pluginConfig.debug) : null
const snapshot = dumper?.snapshot(config)

// ... 执行模型元数据填充 ...

if (dumper && snapshot) {
  await dumper.dump(snapshot, config, allResolved, cacheAge)
}
```

#### Diff 计算逻辑

对 `config.provider` 下每个 mapping 声明的 provider：

1. 记录 `_source`：映射到的 models.dev 条目
2. 记录 `_filled`：本次新增的字段名列表
3. 对每个新填充的字段，记录 `oldValue` → `newValue`
4. 汇总 `_meta.summary`：处理了多少 provider、多少个模型、是否全部匹配

#### 未匹配预警

调试模式下，如果某个 model ID 在 mapping 中声明但在 models.dev 中找不到：
- 在 dump 文件中标注 `"_warning": "not found in models.dev"`
- 同时在 console 输出 warning

### 6.4 通配符映射（未来扩展）

可以支持通配符映射，减少配置书写：

```jsonc
"mapping": {
  "misaka-newapi": {
    "*": "opencode-go/{model}"    // 所有模型默认映射到 opencode-go
  }
}
```

当前版本暂不实现，保持简单。

## 7. 与现有生态的关系

| 项目 | 关系 |
|------|------|
| `opencode-lmstudio` | 参考架构：插件钩子、config 修改、缓存模式 |
| `models.dev` | 数据源：通过 api.json 获取模型元数据 |
| OpenCode | 宿主：通过 `@opencode-ai/plugin` 的 `config` hook 注入增强配置 |
| `@ai-sdk/openai-compatible` | 不直接依赖，是用户 provider 使用的 npm 包 |

## 8. 下一步（待确认后开始实现）

1. [ ] 确认 mapping 配置格式是否合理
2. [ ] 确认字段映射规则是否完整（是否需要补充 `temperature`、`interleaved` 等）
3. [ ] 确认缓存策略（路径 `~/.opencode/models-dev.json`、TTL 24h）
4. [ ] 确认调试模式 dump 格式是否满足审查需求
5. [ ] 开始代码实现
