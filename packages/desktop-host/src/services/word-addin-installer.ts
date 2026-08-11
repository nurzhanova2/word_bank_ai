import fs from "node:fs";
import path from "node:path";

export type ExecFileAsync = (file: string, args: string[]) => Promise<{ stdout: string }>;
export type OpenPath = (path: string) => Promise<string>;

export function parseWordExecutable(registryOutput: string): string | undefined {
  return registryOutput.match(/REG_SZ\s+([^\r\n]*WINWORD\.EXE)\s*$/imu)?.[1]?.trim();
}

export class WordAddInInstaller {
  private readonly registryKeys = [
    "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Winword.exe",
    "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Winword.exe"
  ];

  constructor(
    private readonly execFile: ExecFileAsync,
    private readonly openPath: OpenPath
  ) {}

  async findWordExecutable(): Promise<string | undefined> {
    for (const registryKey of this.registryKeys) {
      try {
        const executable = parseWordExecutable((await this.execFile("reg.exe", ["query", registryKey, "/ve"])).stdout);
        if (executable && fs.existsSync(executable)) return executable;
      } catch { /* Проверяем следующий источник. */ }
    }
    const directories = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter(Boolean) as string[];
    for (const directory of directories) {
      const candidate = path.join(directory, "Microsoft Office", "Root", "Office16", "WINWORD.EXE");
      if (fs.existsSync(candidate)) return candidate;
    }
    return undefined;
  }

  async install(manifestPath: string, addInId: string): Promise<{ wordOpened: boolean }> {
    await this.execFile("reg.exe", [
      "add", "HKCU\\SOFTWARE\\Microsoft\\Office\\16.0\\Wef\\Developer",
      "/v", addInId, "/t", "REG_SZ", "/d", manifestPath, "/f"
    ]);
    const executable = await this.findWordExecutable();
    const wordOpened = executable ? (await this.openPath(executable)) === "" : false;
    return { wordOpened };
  }

  async remove(addInId: string): Promise<void> {
    await this.execFile("reg.exe", [
      "delete", "HKCU\\SOFTWARE\\Microsoft\\Office\\16.0\\Wef\\Developer",
      "/v", addInId, "/f"
    ]);
  }
}
