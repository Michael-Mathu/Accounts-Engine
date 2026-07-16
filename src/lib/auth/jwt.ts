import type { JWTPayload } from "jose";
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);
const issuer = "accounting-engine";
const audience = "accounting-engine";

export async function createToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer,
      audience,
    });
    return payload;
  } catch {
    return null;
  }
}

export async function createMagicLinkToken(
  email: string,
  purpose: "verify" | "reset"
): Promise<string> {
  return createToken({
    sub: email,
    purpose,
    type: "magic-link",
  });
}

export async function verifyMagicLinkToken(
  token: string,
  expectedPurpose: "verify" | "reset"
): Promise<string | null> {
  const payload = await verifyToken(token);
  if (!payload || payload.purpose !== expectedPurpose || payload.type !== "magic-link") {
    return null;
  }
  return payload.sub as string;
}