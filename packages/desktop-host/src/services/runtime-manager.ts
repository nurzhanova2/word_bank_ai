import https from "node:https";
import { createApp } from "@bank-ai/local-runtime/app";
import { getLocalHttpsOptions } from "@bank-ai/local-runtime/https-options";
import { createProvider, MockAiProvider } from "@bank-ai/local-runtime/provider";
import type { ConfigService } from "./config-service.js";

export interface RuntimeState {
  status: "остановлен" | "запускается…" | "работает" | "ошибка запуска";
  provider: string;
  configurationError?: Error;
  runtimeError?: Error;
}

export class RuntimeManager {
  private server?: https.Server;
  private currentState: RuntimeState = { status: "остановлен", provider: "не определён" };

  constructor(
    private readonly config: ConfigService,
    private readonly addinPath: string,
    private readonly port = 3847,
    private readonly host = "127.0.0.1",
    private readonly onStateChange: (state: RuntimeState) => void = () => undefined
  ) {}

  get state(): RuntimeState { return this.currentState; }

  private update(state: RuntimeState): void {
    this.currentState = state;
    this.onStateChange(state);
  }

  async start(): Promise<RuntimeState> {
    this.update({ status: "запускается…", provider: this.currentState.provider });
    this.config.loadEnvironment();
    let provider;
    let configurationError: Error | undefined;
    try { provider = createProvider(); }
    catch (error) {
      configurationError = error instanceof Error ? error : new Error(String(error));
      provider = new MockAiProvider();
    }
    const providerName = configurationError ? "mock — заполните LLM_API_KEY" : provider.name;
    try {
      this.server = https.createServer(await getLocalHttpsOptions(), createApp(provider, this.addinPath));
      await new Promise<void>((resolve, reject) => {
        this.server!.once("error", reject);
        this.server!.listen(this.port, this.host, resolve);
      });
      this.update({ status: "работает", provider: providerName, configurationError });
    } catch (error) {
      this.update({
        status: "ошибка запуска",
        provider: providerName,
        configurationError,
        runtimeError: error instanceof Error ? error : new Error(String(error))
      });
    }
    return this.state;
  }

  async stop(): Promise<void> {
    if (this.server?.listening) await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    this.server = undefined;
    this.update({ status: "остановлен", provider: this.currentState.provider });
  }

  async restart(): Promise<RuntimeState> {
    await this.stop();
    return this.start();
  }
}
