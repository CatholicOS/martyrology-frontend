import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";

// Server components call getTranslations(); in tests they read the English messages.
vi.mock("next-intl/server", () => ({
  getTranslations: async (o?: string | { namespace?: string }) =>
    createTranslator({ locale: "en", messages: en, namespace: (typeof o === "string" ? o : o?.namespace) as never }),
  getLocale: async () => "en",
  setRequestLocale: () => {},
}));
