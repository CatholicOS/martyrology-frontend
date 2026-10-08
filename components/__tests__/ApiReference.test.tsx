import { describe, it, expect, vi } from "vitest";
import { useEffect } from "react";
import { render } from "@testing-library/react";

const { scalar } = vi.hoisted(() => ({ scalar: vi.fn((_props: { configuration: Record<string, unknown> }) => null) }));
vi.mock("@scalar/api-reference-react", () => ({ ApiReferenceReact: scalar }));
vi.mock("@scalar/api-reference-react/style.css", () => ({}));

import ApiReference from "@/components/ApiReference";
import scalarIt from "@/messages/scalar/it.json";

describe("ApiReference", () => {
  it("points Scalar at this site's document and proxy, without Scalar's hosted services", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    render(<ApiReference locale="en" title="API reference" />);
    const config = scalar.mock.calls.at(-1)![0].configuration;
    expect(config).toMatchObject({
      url: "/scalar/openapi.json",
      proxyUrl: "/scalar/proxy",
      forceDarkModeState: "dark",
      hideDarkModeToggle: true,
      telemetry: false,
      withDefaultFonts: false,
      agent: { disabled: true },
      mcp: { disabled: true },
    });
  });

  it("gives Scalar the page's language: our Italian strings, or a built-in locale", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const { unmount } = render(<ApiReference locale="it" title="Riferimento API" />);
    let call = scalar.mock.calls.at(-1)![0] as { configuration: Record<string, unknown> };
    expect(call.configuration.localization).toEqual({ locale: "it", translations: scalarIt });
    unmount();
    render(<ApiReference locale="fr" title="Référence de l'API" />);
    call = scalar.mock.calls.at(-1)![0] as { configuration: Record<string, unknown> };
    expect(call.configuration.localization).toEqual({ locale: "fr" });
    expect(call.configuration.localization).not.toHaveProperty("translations");
  });

  it("keeps the page's localized title instead of Scalar's English one", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    render(<ApiReference locale="it" title="Riferimento API · Martirologio Romano" />);
    const config = scalar.mock.calls.at(-1)![0].configuration as { metaData?: { title?: string } };
    expect(config.metaData?.title).toBe("Riferimento API · Martirologio Romano");
  });

  it("remounts Scalar when the language changes", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const mounts = vi.fn();
    scalar.mockImplementation(() => {
      useEffect(() => mounts(), []);
      return null;
    });
    const { rerender } = render(<ApiReference locale="it" title="Riferimento API" />);
    rerender(<ApiReference locale="fr" title="Référence de l'API" />);
    expect(mounts).toHaveBeenCalledTimes(2);
  });
});
