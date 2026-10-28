import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@/test/intl";

const replace = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ replace }) }));

import TodayRedirect from "@/components/TodayRedirect";

describe("TodayRedirect", () => {
  beforeEach(() => {
    replace.mockReset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 2, 12));
  });

  it("opens today's page, with the comparison when there is one", () => {
    const { unmount } = render(<TodayRedirect edition="martyrologium_romanum_1749" />);
    expect(replace).toHaveBeenLastCalledWith("/read/martyrologium_romanum_1749/10/02");
    unmount();
    render(<TodayRedirect edition="martyrologium_romanum_1749" withEdition="martyrologium_romanum_2004" />);
    expect(replace).toHaveBeenLastCalledWith("/read/martyrologium_romanum_1749/10/02?with=martyrologium_romanum_2004");
    vi.useRealTimers();
  });
});
