import { createSign } from "crypto";
import type { IntegrationCredentials } from "../workspaceIntegrations.js";

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64url");
}

export interface ServiceAccountJson {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export function parseServiceAccount(credentials: IntegrationCredentials): ServiceAccountJson {
  const raw = credentials.apiSecret?.trim() || credentials.apiKey?.trim();
  if (!raw) {
    throw new Error(
      "Google service account JSON is required. Paste the full JSON key file in the API secret field."
    );
  }
  try {
    const parsed = JSON.parse(raw) as ServiceAccountJson;
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("Invalid service account JSON");
    }
    return parsed;
  } catch {
    throw new Error("Google service account must be valid JSON (download from Google Cloud Console).");
  }
}

export async function getGoogleAccessToken(
  serviceAccount: ServiceAccountJson,
  scopes: string[]
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: scopes.join(" "),
      aud: serviceAccount.token_uri ?? "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );

  const unsigned = `${header}.${claim}`;
  const sign = createSign("RSA-SHA256");
  sign.update(unsigned);
  sign.end();
  const signature = sign.sign(serviceAccount.private_key.replace(/\\n/g, "\n"));
  const jwt = `${unsigned}.${base64url(signature)}`;

  const tokenRes = await fetch(serviceAccount.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error ?? `Google auth failed (${tokenRes.status})`);
  }
  return tokenData.access_token;
}
