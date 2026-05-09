from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Could not find block: {label}")
    return text.replace(old, new, 1)


def patch_dashboard() -> None:
    path = Path("app/page.tsx")
    text = path.read_text()

    if 'import { hasActiveSubscription } from "@/lib/subscription";' not in text:
        text = replace_once(
            text,
            'import { createClient } from "@/utils/supabase/server";\n',
            'import { createClient } from "@/utils/supabase/server";\nimport { hasActiveSubscription } from "@/lib/subscription";\n',
            "dashboard subscription import",
        )

    text = text.replace(
        '    hasSubscription = profile?.subscription_status === "basic";',
        '    hasSubscription = hasActiveSubscription(profile?.subscription_status);',
    )

    path.write_text(text)


def patch_rankings() -> None:
    path = Path("app/rankings/page.tsx")
    text = path.read_text()

    if 'import { hasActiveSubscription } from "@/lib/subscription";' not in text:
        text = replace_once(
            text,
            'import { createClient } from "@/utils/supabase/server";\n',
            'import { createClient } from "@/utils/supabase/server";\nimport { hasActiveSubscription } from "@/lib/subscription";\n',
            "rankings subscription import",
        )

    local_helper = '''
function hasActiveSubscription(status: string | null | undefined) {
  return status === "basic" || status === "core" || status === "premium";
}
'''
    text = text.replace(local_helper, "\n")

    path.write_text(text)


def patch_settings() -> None:
    path = Path("app/settings/page.tsx")
    text = path.read_text()

    if 'import { displayPlanName, hasActiveSubscription } from "@/lib/subscription";' not in text:
        text = replace_once(
            text,
            'import { createClient } from "@/utils/supabase/server";\n',
            'import { createClient } from "@/utils/supabase/server";\nimport { displayPlanName, hasActiveSubscription } from "@/lib/subscription";\n',
            "settings subscription import",
        )

    old_display = '''
function displayPlanName(status: string | null | undefined) {
  if (status === "basic") return "Core";
  if (status === "alpha") return "Alpha";
  if (status === "none") return "No active plan";
  return "No active plan";
}

function isPlanActive(status: string | null | undefined) {
  return status === "basic" || status === "alpha";
}
'''
    text = text.replace(old_display, "\n")

    text = text.replace(
        "  const activePlan = isPlanActive(profile?.subscription_status);",
        "  const activePlan = hasActiveSubscription(profile?.subscription_status);",
    )

    path.write_text(text)


patch_dashboard()
patch_rankings()
patch_settings()
print("Subscription status checks now use shared helpers.")
