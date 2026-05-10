from pathlib import Path


def patch_login() -> None:
    path = Path("app/login/page.tsx")
    text = path.read_text()
    text = text.replace('href="/pricing"', 'href="/signup"')
    text = text.replace('Choose a plan', 'Create an account')
    path.write_text(text)


def patch_signup() -> None:
    path = Path("app/signup/page.tsx")
    text = path.read_text()

    text = text.replace('import { useSearchParams } from "next/navigation";\n', '')

    text = text.replace(
'''export default function SignupPage() {
  const searchParams = useSearchParams();
  const selectedPlan = searchParams.get("plan") ?? "";
  const hasSelectedPlan = selectedPlan === "core";

  const [firstName, setFirstName] = useState("");''',
'''export default function SignupPage() {
  const [firstName, setFirstName] = useState("");''')

    text = text.replace(
'''    if (!hasSelectedPlan) {
      setErrorMessage("Please choose a plan before creating your account.");
      return;
    }

''', '')

    text = text.replace(
'''    const siteUrl = window.location.origin;
    const checkoutPath = `/api/create-checkout-session?plan=${encodeURIComponent(selectedPlan)}`;
    const emailRedirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(checkoutPath)}`;

    const { data, error } = await createClient().auth.signUp({''',
'''    const { error } = await createClient().auth.signUp({''')

    text = text.replace('        emailRedirectTo,', '        emailRedirectTo: "https://stockgpt.pro/auth/callback?next=/account",')

    text = text.replace(
'''    if (data.session) {
      window.location.href = checkoutPath;
      return;
    }

''', '')

    text = text.replace(
'''          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#ddb159] sm:text-[10px]">
            Step 2 of 3 · Create account
          </p>''',
'''          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#ddb159] sm:text-[10px]">
            Private access
          </p>''')

    text = text.replace(
'''          <p className="mt-2 text-[12px] font-medium leading-relaxed text-[#faf6f0]/62 sm:text-[13px]">
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
'''          <p className="mt-2 text-[12px] font-medium leading-relaxed text-[#faf6f0]/62 sm:text-[13px]">
            Join StockGPT to access AI rankings, watchlists, portfolio tools and
            premium market intelligence.
          </p>''')

    text = text.replace(
        'Check your email to verify your account. After verification, you will be taken straight to secure payment.',
        'Check your email to verify your account.',
    )

    text = text.replace(
        '{loading ? "Creating..." : hasSelectedPlan ? "Create account & continue to payment" : "Choose a plan first"}',
        '{loading ? "Creating..." : "Create account"}',
    )

    text = text.replace(
'''              <Link href="/login" className="transition hover:text-[#ddb159]">
                Already have an account? Log in
              </Link>
              <span className="text-[#faf6f0]/30">·</span>
              <Link href="/pricing" className="transition hover:text-[#ddb159]">
                Change plan
              </Link>''',
'''              <Link href="/login" className="transition hover:text-[#ddb159]">
                Already have an account? Log in
              </Link>''')

    if "useSearchParams" in text or "hasSelectedPlan" in text or "Choose a plan first" in text:
        raise SystemExit("Plan-first signup remnants remain")

    path.write_text(text)


patch_login()
patch_signup()
print("Restored normal account creation flow.")
