import { validateRequiredPmtiles } from "../files/pmtilesPackage";

import { clearPmtilesConfig, getPmtilesConfig } from "./pmtilesConfig";

export async function hasValidPmtilesPackage(): Promise<boolean> {
  const cfg = getPmtilesConfig();
  const validation = await validateRequiredPmtiles(cfg?.pmtilesPath);
  if (!validation.valid) {
    clearPmtilesConfig();
    return false;
  }
  return true;
}
