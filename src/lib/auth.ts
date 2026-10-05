import { NextResponse } from 'next/server';

export const AUTH_COOKIE_NAME = 'pos_owner_session';
export const AUTH_MAX_AGE = 365 * 24 * 60 * 60;

export type AuthSession = {
  sub: string;
  name: string;
  role: 'admin';
  username: string;
  exp: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not configured');
  }
  return secret;
}

function encodeBase64Url(value: Uint8Array | string): string {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);

  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(padded, 'base64'));
  }

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getSigningKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(getAuthSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createAuthToken(username: string): Promise<string> {
  const payload: AuthSession = {
    sub: '1',
    name: 'Owner',
    role: 'admin',
    username,
    exp: Math.floor(Date.now() / 1000) + AUTH_MAX_AGE,
  };

  const payloadBase64 = encodeBase64Url(JSON.stringify(payload));
  const signature = await crypto.subtle.sign('HMAC', await getSigningKey(), encoder.encode(payloadBase64));

  return `${payloadBase64}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAuthToken(token?: string | null): Promise<AuthSession | null> {
  if (!token) return null;

  const [payloadBase64, signatureBase64] = token.split('.');
  if (!payloadBase64 || !signatureBase64) return null;

  const isValid = await crypto.subtle.verify(
    'HMAC',
    await getSigningKey(),
    decodeBase64Url(signatureBase64) as any,
    encoder.encode(payloadBase64) as any
  );

  if (!isValid) return null;

  try {
    const payload = JSON.parse(decoder.decode(decodeBase64Url(payloadBase64))) as AuthSession;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function setAuthCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: AUTH_MAX_AGE,
  });
  return response;
}

export function clearAuthCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
