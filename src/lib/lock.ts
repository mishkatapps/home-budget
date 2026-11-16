// قفل بيانات الدخل على هذا الجهاز: رمز PIN، واختيارياً بصمة الإصبع أو الوجه (WebAuthn).
// هذا قفل شاشة محلي يحمي من يمسك هاتف المدير وهو مفتوح. الحماية الفعلية للبيانات في الخادم:
// قاعدة البيانات لا ترسل الدخل إلا لحساب المدير الذي سجّله.

interface LockConfig {
  salt: string;
  hash: string;
  /** معرّف بيانات اعتماد البصمة/الوجه إن فعّلها */
  credId?: string;
}

const keyOf = (userId: string) => `incomeLock:${userId}`;
const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function read(userId: string): LockConfig | null {
  try { return JSON.parse(localStorage.getItem(keyOf(userId)) ?? 'null'); } catch { return null; }
}
function write(userId: string, cfg: LockConfig) {
  localStorage.setItem(keyOf(userId), JSON.stringify(cfg));
}

async function hashPin(pin: string, salt: Uint8Array): Promise<string> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: 150_000 }, material, 256);
  return b64(bits);
}

export const hasLock = (userId: string) => !!read(userId);
export const hasBiometric = (userId: string) => !!read(userId)?.credId;
export const clearLock = (userId: string) => localStorage.removeItem(keyOf(userId));

export async function setPin(userId: string, pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  write(userId, { salt: b64(salt), hash: await hashPin(pin, salt) });
}

export async function verifyPin(userId: string, pin: string): Promise<boolean> {
  const cfg = read(userId);
  return !!cfg && (await hashPin(pin, unb64(cfg.salt))) === cfg.hash;
}

/** هل في الجهاز بصمة أو تعرّف وجه يدعمه المتصفح؟ */
export async function biometricAvailable(): Promise<boolean> {
  try { return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }
  catch { return false; }
}

export async function enrollBiometric(userId: string, displayName: string) {
  const cfg = read(userId);
  if (!cfg) throw new Error('اضبط رمز PIN أولاً');
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'ميزانية البيت' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: displayName, displayName },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('لم يكتمل تسجيل البصمة');
  write(userId, { ...cfg, credId: b64(cred.rawId) });
}

/** يطلب من الجهاز بصمة الإصبع أو الوجه؛ ينجح فقط إن تحقق الجهاز من صاحبه */
export async function verifyBiometric(userId: string): Promise<boolean> {
  const cfg = read(userId);
  if (!cfg?.credId) return false;
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: unb64(cfg.credId) as BufferSource }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return !!res;
  } catch { return false; }
}
