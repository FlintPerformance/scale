/**
 * Supabase Edge Function: send-reaction-notification
 *
 * Called from the client when a user reacts to a weight entry.
 * Sends a push notification to the entry owner (if they have push enabled
 * and are not the one reacting).
 *
 * POST body: { entry_owner_id, reactor_name, emoji }
 *
 * Required Supabase secrets:
 *   VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Base64 helpers (shared with send-weight-notifications) ──────────────

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function b64Decode(str: string): Uint8Array {
  const clean = str.replace(/[=\s]/g, '');
  const lookup = new Uint8Array(128);
  for (let i = 0; i < B64_CHARS.length; i++) lookup[B64_CHARS.charCodeAt(i)] = i;
  const out = new Uint8Array(Math.floor(clean.length * 3 / 4));
  let j = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean.charCodeAt(i)];
    const b = lookup[clean.charCodeAt(i + 1)];
    const c = lookup[clean.charCodeAt(i + 2)];
    const d = lookup[clean.charCodeAt(i + 3)];
    out[j++] = (a << 2) | (b >> 4);
    if (i + 2 < clean.length) out[j++] = ((b & 0x0f) << 4) | (c >> 2);
    if (i + 3 < clean.length) out[j++] = ((c & 0x03) << 6) | d;
  }
  return out.slice(0, j);
}

function b64Encode(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    result += B64_CHARS[(a >> 2) & 0x3f];
    result += B64_CHARS[((a & 0x03) << 4) | ((b >> 4) & 0x0f)];
    result += i + 1 < bytes.length ? B64_CHARS[((b & 0x0f) << 2) | ((c >> 6) & 0x03)] : '=';
    result += i + 2 < bytes.length ? B64_CHARS[c & 0x3f] : '=';
  }
  return result;
}

function base64urlEncode(buffer: ArrayBuffer): string {
  return b64Encode(new Uint8Array(buffer)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  return b64Decode(str.replace(/-/g, '+').replace(/_/g, '/'));
}

// ── Web Push crypto ─────────────────────────────────────────────────────

async function importVapidPrivateKey(base64url: string): Promise<CryptoKey> {
  const pubRaw = b64Decode(
    (Deno.env.get('VAPID_PUBLIC_KEY') || '').replace(/-/g, '+').replace(/_/g, '/')
  );
  if (pubRaw.length !== 65 || pubRaw[0] !== 0x04) {
    throw new Error(`Unexpected public key length ${pubRaw.length}`);
  }
  const jwk: JsonWebKey = {
    kty: 'EC', crv: 'P-256', d: base64url,
    x: base64urlEncode(pubRaw.slice(1, 33).buffer),
    y: base64urlEncode(pubRaw.slice(33, 65).buffer),
  };
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

async function createJwt(privateKey: CryptoKey, audience: string, subject: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12, sub: subject,
  };
  const enc = new TextEncoder();
  const headerB64 = base64urlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(enc.encode(JSON.stringify(payload)));
  const input = enc.encode(`${headerB64}.${payloadB64}`);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, input);

  const derSig = new Uint8Array(sig);
  let rawSig: Uint8Array;
  if (derSig.length === 64) {
    rawSig = derSig;
  } else {
    const rLen = derSig[3];
    const r = derSig.slice(4, 4 + rLen);
    const sLen = derSig[5 + rLen];
    const s = derSig.slice(6 + rLen, 6 + rLen + sLen);
    rawSig = new Uint8Array(64);
    rawSig.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
    rawSig.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32));
  }

  return `${headerB64}.${payloadB64}.${base64urlEncode(rawSig)}`;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { result.set(a, offset); offset += a.length; }
  return result;
}

async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', key, ikm));
  const infoKey = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const infoWithCounter = new Uint8Array(info.length + 1);
  infoWithCounter.set(info);
  infoWithCounter[info.length] = 1;
  const result = new Uint8Array(await crypto.subtle.sign('HMAC', infoKey, infoWithCounter));
  return result.slice(0, length);
}

async function encryptPayload(
  plaintext: Uint8Array,
  subscriptionKeys: { p256dh: Uint8Array; auth: Uint8Array },
): Promise<{ ciphertext: Uint8Array; serverPublicKey: Uint8Array }> {
  const localKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', localKeyPair.publicKey));
  const clientPublicKey = await crypto.subtle.importKey(
    'raw', subscriptionKeys.p256dh, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: clientPublicKey }, localKeyPair.privateKey, 256),
  );
  const enc = new TextEncoder();
  const authInfo = concatBytes(enc.encode('WebPush: info\0'), subscriptionKeys.p256dh, serverPublicKey);
  const ikm = await hkdf(sharedSecret, subscriptionKeys.auth, authInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cekInfo = enc.encode('Content-Encoding: aes128gcm\0');
  const nonceInfo = enc.encode('Content-Encoding: nonce\0');
  const cek = await hkdf(ikm, salt, cekInfo, 16);
  const nonce = await hkdf(ikm, salt, nonceInfo, 12);
  const padded = concatBytes(plaintext, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded));
  const rs = new Uint8Array(4);
  const recordSize = padded.length + 16;
  rs[0] = (recordSize >> 24) & 0xff;
  rs[1] = (recordSize >> 16) & 0xff;
  rs[2] = (recordSize >> 8) & 0xff;
  rs[3] = recordSize & 0xff;
  const idlen = new Uint8Array([65]);
  const ciphertext = concatBytes(salt, rs, idlen, serverPublicKey, encrypted);
  return { ciphertext, serverPublicKey };
}

async function sendPushNotification(
  subscription: { endpoint: string; keys_p256dh: string; keys_auth: string },
  payload: object,
  vapidPrivateKey: CryptoKey,
  vapidPublicKey: string,
  vapidSubject: string,
): Promise<{ ok: boolean; expired?: boolean }> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt = await createJwt(vapidPrivateKey, audience, vapidSubject);
    const p256dh = base64urlDecode(subscription.keys_p256dh);
    const auth = base64urlDecode(subscription.keys_auth);
    const plaintext = new TextEncoder().encode(JSON.stringify(payload));
    const { ciphertext } = await encryptPayload(plaintext, { p256dh, auth });

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        TTL: '86400',
        Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      },
      body: ciphertext,
    });

    if (response.status === 410 || response.status === 404) {
      return { ok: false, expired: true };
    }
    return { ok: response.ok };
  } catch {
    return { ok: false };
  }
}

// ── Main handler ─────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
      },
    });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const vapidPrivateKeyRaw = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:noreply@flint.app';

    if (!vapidPrivateKeyRaw || !vapidPublicKey) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), { status: 500, headers: corsHeaders });
    }

    const { entry_owner_id, reactor_name, emoji } = await req.json();
    if (!entry_owner_id || !reactor_name || !emoji) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get push subscriptions for the entry owner
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, keys_p256dh, keys_auth')
      .eq('user_id', entry_owner_id);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no_subscription' }), { headers: corsHeaders });
    }

    const vapidPrivateKey = await importVapidPrivateKey(vapidPrivateKeyRaw);

    const payload = {
      title: `${reactor_name} reacted ${emoji}`,
      body: 'to your weight log',
      tag: 'reaction',
      url: '/',
    };

    let sent = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions) {
      const result = await sendPushNotification(sub, payload, vapidPrivateKey, vapidPublicKey, vapidSubject);
      if (result.ok) sent++;
      else if (result.expired) expiredEndpoints.push(sub.endpoint);
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
    }

    return new Response(JSON.stringify({ sent }), { headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('send-reaction-notification error:', message);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
