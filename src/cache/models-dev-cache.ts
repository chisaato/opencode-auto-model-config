import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import type { ModelsDevData, AutoModelConfig } from "../types"

const DEFAULT_CACHE_PATH = path.join(os.homedir(), ".opencode", "models-dev.json")
const API_URL = "https://models.dev/api.json"
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000 // 24 小时
const DOWNLOAD_TIMEOUT_MS = 30000

export class ModelsDevCache {
  private cachePath: string
  private ttl: number

  constructor(config?: Pick<AutoModelConfig, "cacheTTL" | "cachePath">) {
    this.cachePath = config?.cachePath || DEFAULT_CACHE_PATH
    this.ttl = (config?.cacheTTL ?? 86400) * 1000
  }

  /**
   * 获取 models.dev 数据。如果缓存有效则从缓存返回，否则下载。
   */
  async get(): Promise<ModelsDevData | null> {
    const cached = await this.readFromDisk()
    if (cached && this.isFresh(cached._fetchedAt)) {
      return cached.data
    }

    // 缓存未命中或已过期 — 尝试下载
    try {
      const data = await this.download()
      await this.writeToDisk(data)
      return data
    } catch (error) {
      // 如果下载失败但有过期缓存，则使用过期缓存
      if (cached) {
        console.warn(
          "[auto-model-config] Download failed, using stale cache",
          error instanceof Error ? error.message : String(error),
        )
        return cached.data
      }
      throw error
    }
  }

  /**
   * 强制从 models.dev 下载最新数据
   */
  async download(): Promise<ModelsDevData> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)

    try {
      const response = await fetch(API_URL, {
        method: "GET",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        throw new Error(
          `Failed to download models.dev data: HTTP ${response.status}`,
        )
      }

      return (await response.json()) as ModelsDevData
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * 检查缓存文件是否仍在 TTL 有效期内
   */
  isFresh(fetchedAt?: number): boolean {
    if (!fetchedAt) return false
    return Date.now() - fetchedAt < this.ttl
  }

  /**
   * 获取缓存年龄（秒）
   */
  async getAge(): Promise<number> {
    const cached = await this.readFromDisk()
    if (!cached?._fetchedAt) return -1
    return Math.floor((Date.now() - cached._fetchedAt) / 1000)
  }

  /**
   * 获取缓存文件路径（用于调试信息）
   */
  getCachePath(): string {
    return this.cachePath
  }

  // ── 私有方法 ──────────────────────────────────────

  private async readFromDisk(): Promise<CachedData | null> {
    try {
      const raw = await fs.readFile(this.cachePath, "utf-8")
      const parsed = JSON.parse(raw) as CachedData
      if (parsed.data && typeof parsed.data === "object") {
        return parsed
      }
      return null
    } catch {
      return null
    }
  }

  private async writeToDisk(data: ModelsDevData): Promise<void> {
    const cached: CachedData = {
      _fetchedAt: Date.now(),
      _source: API_URL,
      data,
    }
    await fs.mkdir(path.dirname(this.cachePath), { recursive: true })
    await fs.writeFile(this.cachePath, JSON.stringify(cached, null, 2), "utf-8")
  }
}

interface CachedData {
  _fetchedAt: number
  _source: string
  data: ModelsDevData
}
