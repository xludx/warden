import { SignJWT, jwtVerify } from "jose";
import { env } from "@/util/env";

const ALGORITHM = "HS256";

export type JwtPayload = {
  sub: string;
  email?: string;
  name: string;
  app: string;
  role?: string;
  type: "human" | "service";
  aud?: string;
  scope?: string;
};

export async function signJwt(payload: JwtPayload, secret?: string): Promise<string> {
  const key = new TextEncoder().encode(secret ?? env.JWT_SECRET);
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

export async function verifyJwt(token: string, secret?: string): Promise<JwtPayload> {
  const key = new TextEncoder().encode(secret ?? env.JWT_SECRET);
  const { payload } = await jwtVerify(token, key);
  return payload as unknown as JwtPayload;
}
