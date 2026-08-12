import fs from "node:fs";
import path from "node:path";
import { spawn as spawnProcess } from "node:child_process";

interface ManagedProcess { kill(): unknown }
interface LanguageToolDependencies {
  exists(file: string): boolean;
  spawn(file: string, args: readonly string[], workingDirectory: string): ManagedProcess;
  waitUntilReady(url: string): Promise<boolean>;
}

async function defaultWaitUntilReady(url: string): Promise<boolean> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(500) });
      if (response.ok) return true;
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

export class LanguageToolManager {
  private child?: ManagedProcess;
  private readonly dependencies: LanguageToolDependencies;

  constructor(private readonly resourcesPath: string, private readonly port = 8081, dependencies?: Partial<LanguageToolDependencies>) {
    this.dependencies = {
      exists: dependencies?.exists ?? fs.existsSync,
      spawn: dependencies?.spawn ?? ((file, args, workingDirectory) => spawnProcess(file, [...args], { cwd: workingDirectory, windowsHide: true, stdio: "ignore" })),
      waitUntilReady: dependencies?.waitUntilReady ?? defaultWaitUntilReady
    };
  }

  async start(): Promise<boolean> {
    const java = path.join(this.resourcesPath, "jre", "bin", "java.exe");
    const jar = path.join(this.resourcesPath, "languagetool", "languagetool-server.jar");
    if (!this.dependencies.exists(java) || !this.dependencies.exists(jar)) return false;
    this.child = this.dependencies.spawn(java, [
      "-Xms64m", "-Xmx512m", "-cp", jar, "org.languagetool.server.HTTPServer",
      "--port", String(this.port), "--allow-origin", "https://localhost:3847"
    ], path.dirname(jar));
    const ready = await this.dependencies.waitUntilReady(`http://127.0.0.1:${this.port}/v2/languages`);
    if (!ready) this.stop();
    return ready;
  }

  stop(): void {
    this.child?.kill();
    this.child = undefined;
  }
}
