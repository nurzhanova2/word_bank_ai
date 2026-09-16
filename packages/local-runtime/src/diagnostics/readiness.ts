import type { AiProvider } from "../providers/types.js";

export type Readiness = "ok" | "not_configured" | "unavailable" | "timeout" | "unknown";
export interface ProbeResult { status: Readiness }
export interface DiagnosticsResult { status: "ok" | "degraded" | "error"; runtime: ProbeResult; https: ProbeResult; languageTool: ProbeResult; provider: ProbeResult & { configured: boolean; name: string } }

export class ReadinessService {
  private cached?: { at: number; value: DiagnosticsResult };
  private inFlight?: Promise<DiagnosticsResult>;
  constructor(private readonly provider: AiProvider, private readonly languageToolUrl: string, private readonly fetcher: typeof fetch = fetch, private readonly ttlMs = 30_000) {}
  async check(force = false): Promise<DiagnosticsResult> {
    if (!force && this.cached && Date.now() - this.cached.at < this.ttlMs) return this.cached.value;
    if (!force && this.inFlight) return this.inFlight;
    const task = this.measure(); this.inFlight = task;
    try { const value = await task; this.cached = { at: Date.now(), value }; return value; }
    finally { this.inFlight = undefined; }
  }
  private async measure(): Promise<DiagnosticsResult> {
    const configured = this.provider.name !== "mock";
    const languageTool = await this.probeLanguageTool();
    const provider: DiagnosticsResult["provider"] = configured
      ? { status: await this.probeProvider(), configured, name: this.provider.name }
      : { status: "not_configured", configured, name: this.provider.name };
    const status: DiagnosticsResult["status"] = provider.status === "ok" && languageTool.status === "ok" ? "ok" : "degraded";
    return { status, runtime: { status: "ok" }, https: { status: "ok" }, languageTool, provider };
  }
  private async probeProvider(): Promise<Readiness> { return this.provider.probeReadiness?.() ?? "unknown"; }
  private async probeLanguageTool(): Promise<ProbeResult> {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 1_500);
    try { const response = await this.fetcher(this.languageToolUrl, { method: "OPTIONS", signal: controller.signal }); return { status: response.ok || response.status === 405 ? "ok" : "unavailable" }; }
    catch (error) { return { status: error instanceof DOMException && error.name === "AbortError" ? "timeout" : "unavailable" }; }
    finally { clearTimeout(timer); }
  }
}
