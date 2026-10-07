import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

const { scalar } = vi.hoisted(() => ({ scalar: vi.fn((_props: { configuration: Record<string, unknown> }) => null) }));
vi.mock("@scalar/api-reference-react", () => ({ ApiReferenceReact: scalar }));
vi.mock("@scalar/api-reference-react/style.css", () => ({}));

import ApiReference from "@/components/ApiReference";

describe("ApiReference", () => {
  it("points Scalar at this site's document and proxy, without Scalar's hosted services", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    render(<ApiReference />);
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
});
