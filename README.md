# opencode-auto-model-config

OpenCode 插件：根据 [models.dev](https://models.dev) 数据为自定义 provider 自动填充模型元数据。

## 介绍

当你在 OpenCode 中配置自定义 provider（如 OpenAI 兼容 API、第三方模型服务）时，需要手动填写模型的详细信息（上下文窗口、能力、费用等）。这个插件可以自动从 models.dev 获取这些元数据，并填充到你的 OpenCode 配置中。

主要功能：
- 自动从 models.dev 获取模型元数据
- 支持自定义 provider 和模型 ID 映射
- 本地缓存（24 小时），避免频繁请求
- 不覆盖用户已填写的字段
- 支持调试模式，可查看配置变更

## 使用

### 安装

```bash
npm install <npm-package-name>
# 或
bun add <npm-package-name>
```

### 在 OpenCode 中启用

在 `opencode.json` 中添加插件：

```json
{
  "plugin": ["<npm-package-name>"]
}
```

## 配置

插件会自动在 `~/.config/opencode/oc-auto-model-config.json` 创建配置文件。首次运行后，编辑该文件添加模型映射。

### 配置文件格式

```json
{
  "mapping": {
    "your-provider-name": {
      "model-id": "modelsdev-provider/modelsdev-model-id"
    }
  }
}
```

### 示例

假设你的 OpenCode 配置中有：

```json
{
  "provider": {
    "my-openai": {
      "models": {
        "gpt-4o": {}
      }
    }
  }
}
```

在 `oc-auto-model-config.json` 中添加映射：

```json
{
  "mapping": {
    "my-openai": {
      "gpt-4o": "openai/gpt-4o"
    }
  }
}
```

重启 OpenCode 后，`gpt-4o` 模型会自动填充以下字段：
- `name`: 模型显示名称
- `modalities`: 输入输出模态
- `limit`: 上下文窗口和输出限制
- `attachment`: 是否支持附件
- `tool_call`: 是否支持工具调用
- `reasoning`: 是否支持推理
- `structured_output`: 是否支持结构化输出
- `cost`: 每百万 token 费用
- `knowledge`: 知识截止日期

### 配置选项

```json
{
  "mapping": { ... },
  "cacheTTL": 86400,
  "cachePath": "~/.opencode/models-dev.json",
  "debug": {
    "enabled": false,
    "dumpPath": "~/.opencode/expanded-config.json",
    "diffOnly": true
  }
}
```

- `mapping`: 模型映射关系（必填）
- `cacheTTL`: 缓存有效期，单位秒（默认 86400 = 24 小时）
- `cachePath`: 自定义缓存文件路径
- `debug.enabled`: 启用调试输出
- `debug.dumpPath`: 调试输出文件路径
- `debug.diffOnly`: 仅输出变更的字段（默认 true）