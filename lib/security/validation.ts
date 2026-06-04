export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{1,60}$/;
const PHONE_RE = /^[0-9+()\-\s]{0,25}$/;
const TICKER_RE = /^[A-Z][A-Z0-9.-]{0,11}$/;

export function cleanString(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export function cleanEmail(value: unknown) {
  return cleanString(value, 254).toLowerCase();
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export function isValidName(value: string) {
  return NAME_RE.test(value);
}

export function isValidPhone(value: string) {
  return PHONE_RE.test(value);
}

export function cleanTicker(value: unknown) {
  return cleanString(value, 12).toUpperCase();
}

export function isValidTicker(value: string) {
  return TICKER_RE.test(value);
}

export function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;

  const [year, month, day] = value.split("-").map(Number);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function ageFromDate(date: Date) {
  const today = new Date();
  let age = today.getUTCFullYear() - date.getUTCFullYear();

  const monthDiff = today.getUTCMonth() - date.getUTCMonth();
  const dayDiff = today.getUTCDate() - date.getUTCDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age;
}

export function validateSignupPayload(body: unknown): ValidationResult<{
  firstName: string;
  lastName: string;
  fullName: string;
  dob: string;
  phone: string;
  email: string;
  password: string;
  marketingConsent: boolean;
  emailConsent: boolean;
  termsAccepted: boolean;
  newsletterDigestConsent: boolean;
  consentCapturedAt: string;
}> {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const firstName = cleanString(record.firstName, 60);
  const lastName = cleanString(record.lastName, 60);
  const dob = cleanString(record.dob, 10);
  const phone = cleanString(record.phone, 25);
  const email = cleanEmail(record.email);
  const password = typeof record.password === "string" ? record.password : "";

  const marketingConsent = record.marketingConsent === true;
  const emailConsent = record.emailConsent === true;
  const termsAccepted = record.termsAccepted === true;
  const newsletterDigestConsent = record.newsletterDigestConsent === true;

  if (!firstName || !lastName || !dob || !email || !password) {
    return {
      ok: false,
      message: "Please complete first name, last name, date of birth, email and password.",
    };
  }

  if (!isValidName(firstName) || !isValidName(lastName)) {
    return {
      ok: false,
      message: "Names can only contain letters, spaces, hyphens and apostrophes.",
    };
  }

  const parsedDob = parseIsoDate(dob);
  if (!parsedDob) {
    return {
      ok: false,
      message: "Enter a valid date of birth.",
    };
  }

  if (ageFromDate(parsedDob) < 18) {
    return {
      ok: false,
      message: "StockGPT is only available to users aged 18 or over.",
    };
  }

  if (phone && !isValidPhone(phone)) {
    return {
      ok: false,
      message: "Enter a valid phone number or leave it blank.",
    };
  }

  if (!isValidEmail(email)) {
    return {
      ok: false,
      message: "Enter a valid email address.",
    };
  }

  if (password.length < 12) {
    return {
      ok: false,
      message: "Password must be at least 12 characters.",
    };
  }

  if (!emailConsent) {
    return {
      ok: false,
      message: "Please confirm email consent so we can send account and security emails.",
    };
  }

  if (!termsAccepted) {
    return {
      ok: false,
      message: "Please accept the terms and conditions to create an account.",
    };
  }

  return {
    ok: true,
    data: {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      dob,
      phone,
      email,
      password,
      marketingConsent,
      emailConsent,
      termsAccepted,
      newsletterDigestConsent,
      consentCapturedAt: new Date().toISOString(),
    },
  };
}

export function validateProfilePayload(body: {
  full_name?: string;
  date_of_birth?: string;
  phone?: string;
}): ValidationResult<{
  full_name: string;
  date_of_birth: string | null;
  phone: string;
}> {
  const fullName = cleanString(body.full_name, 121);
  const dob = cleanString(body.date_of_birth, 10);
  const phone = cleanString(body.phone, 25);

  if (fullName && !/^[A-Za-zÀ-ÖØ-öø-ÿ' -]{1,121}$/.test(fullName)) {
    return {
      ok: false,
      message: "Name can only contain letters, spaces, hyphens and apostrophes.",
    };
  }

  let date_of_birth: string | null = null;

  if (dob) {
    const parsedDob = parseIsoDate(dob);
    if (!parsedDob) {
      return { ok: false, message: "Enter a valid date of birth." };
    }

    if (ageFromDate(parsedDob) < 18) {
      return {
        ok: false,
        message: "StockGPT is only available to users aged 18 or over.",
      };
    }

    date_of_birth = dob;
  }

  if (phone && !isValidPhone(phone)) {
    return {
      ok: false,
      message: "Enter a valid phone number or leave it blank.",
    };
  }

  return {
    ok: true,
    data: {
      full_name: fullName,
      date_of_birth,
      phone,
    },
  };
}
