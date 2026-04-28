import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { AutoModelConfig } from "../types";

const CONFIG_FILENAME = "oc-auto-model-config.json";

export async function loadConfig(): Promise<AutoModelConfig | null> {
	const searchPaths = [
		path.join(os.homedir(), ".config", "opencode", CONFIG_FILENAME),
		path.join(process.cwd(), CONFIG_FILENAME),
	];

	for (const configPath of searchPaths) {
		try {
			const raw = await fs.readFile(configPath, "utf-8");
			const parsed = JSON.parse(raw);
			return parseAutoModelConfig(parsed, configPath);
		} catch {
			continue;
		}
	}

	await autoCreateConfig(
		path.join(os.homedir(), ".config", "opencode", CONFIG_FILENAME),
	);

	return null;
}

async function autoCreateConfig(configPath: string): Promise<void> {
	const template = {
		"//": "OpenCode Auto Model Config - add model mapping rules below",
		"//usage":
			'Format: { "providerName": { "modelId": "modelsdev-provider/modelsdev-model-id" } }',
		"//example": '{ "my-provider": { "gpt-4o": "openai/gpt-4o" } }',
		mapping: {},
	};
	try {
		await fs.writeFile(
			configPath,
			JSON.stringify(template, null, 2) + "\n",
			"utf-8",
		);
		console.log(`[auto-model-config] Created default config: ${configPath}`);
		console.log(
			`[auto-model-config] Edit ${CONFIG_FILENAME} to add model mappings, then restart OpenCode`,
		);
	} catch (err) {
		console.warn(
			`[auto-model-config] Failed to create default config at ${configPath}:`,
			err,
		);
	}
}

function parseAutoModelConfig(
	raw: any,
	configPath: string,
): AutoModelConfig | null {
	if (!raw || typeof raw !== "object") {
		console.warn(`[auto-model-config] Invalid config in ${configPath}`);
		return null;
	}

	if (
		!raw.mapping ||
		typeof raw.mapping !== "object" ||
		Object.keys(raw.mapping).length === 0
	) {
		console.warn(`[auto-model-config] No mapping configured in ${configPath}`);
		return null;
	}

	console.log(`[auto-model-config] Loaded config from ${configPath}`);

	return {
		cacheTTL: typeof raw.cacheTTL === "number" ? raw.cacheTTL : undefined,
		cachePath: raw.cachePath ?? undefined,
		mapping: raw.mapping as Record<string, Record<string, string>>,
		debug: parseDebugConfig(raw.debug),
	};
}

function parseDebugConfig(raw: any): AutoModelConfig["debug"] {
	if (!raw || typeof raw !== "object" || raw.enabled !== true) {
		return undefined;
	}
	return {
		enabled: true,
		dumpPath: typeof raw.dumpPath === "string" ? raw.dumpPath : undefined,
		diffOnly: raw.diffOnly !== undefined ? !!raw.diffOnly : true,
	};
}

export function getMappedProviders(config: AutoModelConfig): string[] {
	return Object.keys(config.mapping);
}

export function getMappingTarget(
	config: AutoModelConfig,
	providerName: string,
	modelId: string,
): string | null {
	const providerMapping = config.mapping[providerName];
	if (!providerMapping) return null;
	return providerMapping[modelId] || null;
}
