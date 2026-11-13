import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HomeClient } from "./HomeClient";

// A thin server page (`nextjs-app-structure` Pages rules): metadata from translations, then the client page.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home.meta");
  return { title: t("title"), description: t("description") };
}

export default function Page() {
  return <HomeClient />;
}
