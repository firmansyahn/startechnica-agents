"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/shadcn-ui/button";

// Replace with the app's first real page; keep the shape: one client component per page.
export function HomeClient() {
  const t = useTranslations("home");
  const common = useTranslations("common");
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
      <div className="flex gap-2">
        <Button onClick={() => toast.success(common("save"))}>{common("save")}</Button>
        <Button variant="outline">{common("cancel")}</Button>
      </div>
    </main>
  );
}
