import "server-only";
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

// next-intl without locale routing: the locale comes from a cookie the app's language picker sets,
// falling back to the default. Add i18n routing instead if URLs must carry the locale.
export const LOCALES = ["en"] as const;   // add a locale here and its file in src/messages/
export const DEFAULT_LOCALE = "en";

export default getRequestConfig(async () => {
  const fromCookie = (await cookies()).get("locale")?.value;
  const locale = (LOCALES as readonly string[]).includes(fromCookie ?? "") ? fromCookie! : DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: "UTC",   // or the user's customer from the session
  };
});
