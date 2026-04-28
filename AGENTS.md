# opencode-auto-model-config

OpenCode 插件：根据 [models.dev](https://models.dev) 数据为自定义 provider 自动填充模型元数据。

## 项目定位

这是一个 **OpenCode 插件**，不是一个独立应用。入口：`src/index.ts` → 导出 `AutoModelConfigPlugin`。OpenCode 启动时通过 `config` hook 调用此插件，插件直接修改 `config` 对象，无需返回值。

## 开发命令

```bash
bun run typecheck    # tsc --noEmit（无 build 步骤，OpenCode 直接加载 TS）
bunx vitest run      # 运行全部测试（28 个）
bunx vitest          # watch 模式
```

无需 `bun run build` — OpenCode 通过 `"main": "./src/index.ts"` 直接加载 TypeScript。

## 架构

```
src/
├── index.ts              # 入口：export const AutoModelConfigPlugin
├── plugin/
│   ├── index.ts          # Plugin 工厂：返回 { config: createConfigHook() }
│   └── config-hook.ts    # config hook: 读配置 → 读缓存 → 解析映射 → 填充模型
├── mapping/
│   ├── parser.ts         # 读 oc-auto-model-config.json（非 opencode.json！）
│   └── resolver.ts       # 根据映射查 models.dev 数据
├── cache/
│   └── models-dev-cache.ts # 文件缓存：~/.opencode/models-dev.json（TTL 24h，自动下载）
├── debug/
│   └── config-dumper.ts  # 调试模式：dump 增强后的配置到文件
├── utils/
│   └── fields-mapper.ts  # models.dev 字段 → OpenCode 配置字段的映射规则
└── types/
    └── index.ts          # 共享类型
```

### 关键设计决策

- **插件有自己的配置文件，不占用 opencode.json。** 映射写在 `oc-auto-model-config.json`，搜索顺序：`~/.config/opencode/` → 工作目录
- **Config hook 只做配置增强，不需要其他 hooks**（参考 `@opencode-ai/plugin` 的 `Hooks` 接口）
- **绝不覆盖用户已填写的字段** — 只填充 `existingModel` 中不存在的 key
- models.dev API 数据缓存在 `~/.opencode/models-dev.json`，TTL 24h，下载失败时降级使用过期缓存

## 用户配置示例

`opencode.json` 只声明 provider 和空 model，不需要放插件配置：

```jsonc
{
	"plugin": ["opencode-auto-model-config@latest"],
	"provider": { "newapi": { "models": { "gpt-5.4": {} } } },
}
```

`~/.config/opencode/oc-auto-model-config.json` 放映射：

```jsonc
{
	"mapping": { "newapi": { "gpt-5.4": "opencode-go/gpt-5.4" } },
	"debug": { "enabled": true },
}
```

## 测试须知

- 测试使用用户本地的真实 models.dev 缓存 `/home/user/.config/opencode/models-dev.json`（如果存在）
- `resolver.test.ts` 和 `config-hook.test.ts` 中的真实数据测试会在缓存不可用时自动跳过
- `parser.test.ts` 测试会 `chdir` 到临时目录创建模拟配置文件，不会影响全局状态

## 约束

- ESM only（`"type": "module"`），使用 `import` / `export`
- `tsconfig` 开启 `strict: true`
- 唯一运行时依赖：`@opencode-ai/plugin`
- 不要引入新的 npm 依赖，除非经过讨论
