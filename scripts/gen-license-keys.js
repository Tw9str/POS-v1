#!/usr/bin/env node
/**
 * Generate Ed25519 key pair for license signing.
 *
 * Private key → LICENSE_PRIVATE_KEY env var (server only, NEVER expose)
 * Public key  → certificates/license-public.pem (bundled with client, safe to expose)
 *
 * Usage:  node scripts/gen-license-keys.js
 */

import { exportJWK, exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

async function main() {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA", {
    crv: "Ed25519",
    extractable: true,
  });

  const privatePem = await exportPKCS8(privateKey);
  const publicPem = await exportSPKI(publicKey);
  const publicJwk = await exportJWK(publicKey);

  // Save public key PEM to certificates/
  const certDir = join(root, "certificates");
  mkdirSync(certDir, { recursive: true });
  writeFileSync(join(certDir, "license-public.pem"), publicPem);

  // Save public JWK for client-side usage
  writeFileSync(
    join(certDir, "license-public.jwk.json"),
    JSON.stringify(publicJwk, null, 2),
  );

  console.log("\n✅ Ed25519 key pair generated!\n");
  console.log("─── Public key (safe to expose) ───");
  console.log(`Written to: certificates/license-public.pem`);
  console.log(`Written to: certificates/license-public.jwk.json\n`);

  console.log("─── Private key (ADD TO .env, NEVER COMMIT) ───");
  console.log("LICENSE_PRIVATE_KEY='" + privatePem.replace(/\n/g, "\\n") + "'");
  console.log(
    "\nCopy the line above into your .env file. The \\n escapes are intentional.",
  );
}

main().catch(console.error);
