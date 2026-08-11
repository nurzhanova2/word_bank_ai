import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { X509Certificate } from "node:crypto";
import type { ServerOptions } from "node:https";
import { getHttpsServerOptions } from "office-addin-dev-certs";

export async function getLocalHttpsOptions(): Promise<ServerOptions> {
  const certificateDirectory = path.join(os.homedir(), ".office-addin-dev-certs");
  const certificatePath = path.join(certificateDirectory, "localhost.crt");
  const keyPath = path.join(certificateDirectory, "localhost.key");

  try {
    const cert = fs.readFileSync(certificatePath);
    const key = fs.readFileSync(keyPath);
    const certificate = new X509Certificate(cert);
    const now = Date.now();

    if (Date.parse(certificate.validFrom) <= now && now < Date.parse(certificate.validTo)) {
      return { cert, key };
    }
  } catch {
    // The Office helper below creates and trusts a certificate when none is usable.
  }

  return getHttpsServerOptions();
}
