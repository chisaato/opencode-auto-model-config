import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type {
	AutoModelConfig,
	ProcessingSummary,
	ConfigObject,
	ResolvedModel,
} from "../types";

const DEFAULT_DUMP_PATH = path.join(
	os.homedir(),
	".config",
	"opencode",
	"expanded-config.json",
);

export class ConfigDumper {
	private config: NonNullable<AutoModelConfig["debug"]>;
	private dumpPath: string;

	constructor(debugConfig: NonNullable<AutoModelConfig["debug"]>) {
		this.config = debugConfig;
		this.dumpPath = debugConfig.dumpPath || DEFAULT_DUMP_PATH;
	}

	/**
	 * 在处理之前对配置进行深拷贝快照。
	 */
	snapshot(original: ConfigObject): ConfigObject {
		return JSON.parse(JSON.stringify(original));
	}

	/**
	 * 计算原始快照与处理后配置之间的差异，然后写入输出文件。
	 */
	async dump(
		snapshot: ConfigObject,
		current: ConfigObject,
		resolvedModels: Map<string, Map<string, ResolvedModel>>,
		cacheAge: number,
	): Promise<void> {
		const diffOnly = this.config.diffOnly !== false;

		const content = diffOnly
			? this.buildDiffOutput(snapshot, current, resolvedModels, cacheAge)
			: this.buildFullOutput(current, resolvedModels, cacheAge);

		await fs.mkdir(path.dirname(this.dumpPath), { recursive: true });
		await fs.writeFile(
			this.dumpPath,
			JSON.stringify(content, null, 2),
			"utf-8",
		);
		console.log(`[auto-model-config] Debug dump written to: ${this.dumpPath}`);
	}

	/**
	 * 构建差异输出：仅显示变更内容和元数据。
	 */
	private buildDiffOutput(
		snapshot: ConfigObject,
		current: ConfigObject,
		resolvedModels: Map<string, Map<string, ResolvedModel>>,
		cacheAge: number,
	): Record<string, any> {
		const meta = this.buildMeta(resolvedModels, cacheAge);
		const output: Record<string, any> = { _meta: meta };

		if (meta.errors && meta.errors.length > 0) {
			return output;
		}

		output.provider = {};
		const snapshotProviders = snapshot.provider || {};
		const currentProviders = current.provider || {};

		for (const [providerKey, models] of resolvedModels) {
			output.provider[providerKey] = { models: {} };

			for (const [modelId, resolved] of models) {
				const entry: Record<string, any> = {
					_source: resolved.source,
					_filled: resolved.filledFields,
				};

				if (resolved.warning) {
					entry._warning = resolved.warning;
				} else {
					// 仅包含实际填充的字段
					const configFields =
						currentProviders[providerKey]?.models?.[modelId] || {};
					for (const field of resolved.filledFields) {
						if (field in configFields) {
							entry[field] = configFields[field];
						}
					}
				}

				output.provider[providerKey].models[modelId] = entry;
			}
		}

		return output;
	}

	/**
	 * 构建完整输出：完整的处理后配置。
	 */
	private buildFullOutput(
		current: ConfigObject,
		resolvedModels: Map<string, Map<string, ResolvedModel>>,
		cacheAge: number,
	): Record<string, any> {
		const meta = this.buildMeta(resolvedModels, cacheAge);
		return { _meta: meta, ...current };
	}

	/**
	 * 构建元数据摘要。
	 */
	private buildMeta(
		resolvedModels: Map<string, Map<string, ResolvedModel>>,
		cacheAge: number,
	): ProcessingSummary {
		let modelsFilled = 0;
		let modelsNotFound = 0;
		let modelsSkipped = 0;
		const mappingsUsed: Record<string, string> = {};
		const errors: string[] = [];

		for (const [, models] of resolvedModels) {
			for (const [modelId, resolved] of models) {
				mappingsUsed[modelId] = resolved.source;
				if (resolved.warning) {
					modelsNotFound++;
					errors.push(`${modelId}: ${resolved.warning}`);
				} else if (resolved.filledFields.length > 0) {
					modelsFilled++;
				} else {
					modelsSkipped++;
				}
			}
		}

		return {
			plugin: "opencode-auto-model-config",
			timestamp: new Date().toISOString(),
			modelsDevCacheAge: cacheAge,
			summary: {
				providersProcessed: resolvedModels.size,
				modelsFilled,
				modelsNotFound,
				modelsSkipped,
				mappingsUsed,
			},
			...(errors.length > 0 ? { errors } : {}),
		};
	}
}
