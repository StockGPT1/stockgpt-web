from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Could not find block: {label}")
    return text.replace(old, new, 1)


def patch_pricing() -> None:
    path = Path("app/pricing/page.tsx")
    text = path.read_text()

    old = '''                <form
                  action="/api/create-checkout-session"
                  method="post"
                  className="mt-auto pt-5 lg:pt-3 xl:pt-4"
                >
                  <div className="mb-2 hidden h-9 lg:block xl:h-10" />

                  <button
                    type="submit"
                    className="flex h-11 w-full items-center justify-center rounded-full border-2 border-[#ddb159] bg-[#ddb159] text-[13px] font-black text-[#072116] shadow-[0_12px_30px_rgba(221,177,89,0.2)] transition hover:bg-[#c9a04f] sm:h-12 sm:text-[14px] lg:h-10 lg:text-[13px] xl:h-11"
                  >
                    Start Core subscription
                  </button>
                </form>'''

    new = '''                <div className="mt-auto pt-5 lg:pt-3 xl:pt-4">
                  <div className="mb-2 hidden h-9 lg:block xl:h-10" />

                  <Link
                    href="/signup?plan=core"
                    className="flex h-11 w-full items-center justify-center rounded-full border-2 border-[#ddb159] bg-[#ddb159] text-[13px] font-black text-[#072116] shadow-[0_12px_30px_rgba(221,177,89,0.2)] transition hover:bg-[#c9a04f] sm:h-12 sm:text-[14px] lg:h-10 lg:text-[13px] xl:h-11"
                  >
                    Choose Core & create account
                  </Link>
                </div>'''

    text = replace_once(text, old, new, "pricing core checkout form")
    path.write_text(text)


def patch_login() -> None:
    path = Path("app/login/page.tsx")
    text = path.read_text()
    text = text.replace('href="/signup"', 'href="/pricing"')
    text = text.replace('Create an account', 'Choose a plan')
    path.write_text(text)


def patch_signup() -> None:
    path = Path("app/signup/page.tsx")
    text = path.read_text()

    text = text.replace('import { useState } from "react";', 'import { useState } from "react";')
    if 'import { useSearchParams } from "next/navigation";' not in text:
        text = replace_once(
            text,
            'import Link from "next/link";\n',
            'import Link from "next/link";\nimport { useSearchParams } from "next/navigation";\n',
            "signup search params import",
        )

    text = replace_once(
        text,
        '''export default function SignupPage() {
  const [firstName, setFirstName] = useState("");''',
        '''export default function SignupPage() {
  const searchParams = useSearchParams();
  const selectedPlan = searchParams.get("plan") ?? "";
  const hasSelectedPlan = selectedPlan === "core";

  const [firstName, setFirstName] = useState("");''',
        "signup selected plan state",
    )

    text = replace_once(
        text,
        '''    if (!cleanFirstName || !cleanLastName || !cleanEmail || !password) {
      setErrorMessage("Please complete your first name, last name, email and password.");
      return;
    }

    setLoading(true);

    const { error } = await createClient().auth.signUp({''',
        '''    if (!hasSelectedPlan) {
      setErrorMessage("Please choose a plan before creating your account.");
      return;
    }

    if (!cleanFirstName || !cleanLastName || !cleanEmail || !password) {
      setErrorMessage("Please complete your first name, last name, email and password.");
      return;
    }

    setLoading(true);

    const siteUrl = window.location.origin;
    const checkoutPath = `/api/create-checkout-session?plan=${encodeURIComponent(selectedPlan)}`;
    const emailRedirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(checkoutPath)}`;

    const { data, error } = await createClient().auth.signUp({''',
        "signup validation and redirect setup",
    )

    text = text.replace(
        '        emailRedirectTo: "https://stockgpt.pro/auth/callback?next=/account",',
        '        emailRedirectTo,',
    )

    text = replace_once(
        text,
        '''    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSent(true);''',
        '''    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (data.session) {
      window.location.href = checkoutPath;
      return;
    }

    setSent(true);''',
        "signup post success checkout redirect",
    )

    text = text.replace(
        '            Check your email to verify your account.',
        '            Check your email to verify your account. After verification, you will be taken straight to secure payment.',
    )

    text = replace_once(
        text,
        '''          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#ddb159] sm:text-[10px]">
            Private access
          </p>

          <h1 className="mt-1.5 text-[28px] font-black leading-none tracking-[-0.04em] sm:text-[34px]">
            Create your account.
          </h1>

          <p className="mt-2 text-[12px] font-medium leading-relaxed text-[#faf6f0]/62 sm:text-[13px]">
            Join StockGPT to access AI rankings, watchlists, portfolio tools and
            premium market intelligence.
          </p>''',
        '''          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#ddb159] sm:text-[10px]">
            Step 2 of 3 · Create account
          </p>

          <h1 className="mt-1.5 text-[28px] font-black leading-none tracking-[-0.04em] sm:text-[34px]">
            Create your account.
          </h1>

          <p className="mt-2 text-[12px] font-medium leading-relaxed text-[#faf6f0]/62 sm:text-[13px]">
            {hasSelectedPlan
              ? "Core selected. Create your account, then continue straight to secure payment."
              : "Choose a plan first, then create your account and continue to payment."}
          </p>

          <div className="mt-3 rounded-2xl border border-[#ddb159]/18 bg-[#04180f]/55 p-3 text-[11px] font-bold text-[#faf6f0]/70">
            {hasSelectedPlan ? (
              <div className="flex items-center justify-between gap-3">
                <span>Selected plan</span>
                <span className="rounded-full bg-[#ddb159] px-3 py-1 text-[10px] font-black text-[#072116]">
                  Core · £12/month
                </span>
              </div>
            ) : (
              <Link href="/pricing" className="inline-flex font-black text-[#ddb159] hover:underline">
                Choose a plan to continue →
              </Link>
            )}
          </div>''',
        "signup header plan messaging",
    )

    text = text.replace(
        '{loading ? "Creating..." : "Create account"}',
        '{loading ? "Creating..." : hasSelectedPlan ? "Create account & continue to payment" : "Choose a plan first"}',
    )

    text = text.replace(
        '              <Link href="/login" className="transition hover:text-[#ddb159]">\n                Already have an account? Log in\n              </Link>',
        '              <Link href="/login" className="transition hover:text-[#ddb159]">\n                Already have an account? Log in\n              </Link>\n              <span className="text-[#faf6f0]/30">·</span>\n              <Link href="/pricing" className="transition hover:text-[#ddb159]">\n                Change plan\n              </Link>',
    )

    path.write_text(text)


patch_pricing()
patch_login()
patch_signup()
print("Plan-first signup flow patched.")
