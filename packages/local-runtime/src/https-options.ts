import type { ServerOptions } from "node:https";
import { getHttpsServerOptions } from "office-addin-dev-certs";

export type CertificateOptionsLoader = () => Promise<ServerOptions>;

export async function getLocalHttpsOptions(
  loadTrustedOptions: CertificateOptionsLoader = getHttpsServerOptions
): Promise<ServerOptions> {
  // Validity dates alone do not mean that Word trusts the issuing CA. The Office
  // helper verifies the current-user certificate store and repairs it if needed.
  return loadTrustedOptions();
}
