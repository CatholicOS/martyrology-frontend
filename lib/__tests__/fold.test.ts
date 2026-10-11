import { describe, it, expect } from "vitest";
import { fold } from "@/lib/fold";

describe("fold", () => {
  it("drops case, accents and Vietnamese's stacked marks", () => {
    expect(fold("Lê Văn Phụng")).toBe("le van phung");
    expect(fold("PHỤNG")).toBe("phung");
    expect(fold("Nguyễn Văn Hạnh")).toBe("nguyen van hanh");
  });

  it("makes the letters NFD leaves whole plain: đ ð → d, ł → l, ø → o, upper case too", () => {
    expect(fold("Đinh")).toBe("dinh");
    expect(fold("đinh")).toBe("dinh");
    expect(fold("Guðmundur")).toBe("gudmundur");
    expect(fold("Łódź")).toBe("lodz");
    expect(fold("Søren")).toBe("soren");
    expect(fold("ØSTER")).toBe("oster");
  });

  it("spells out æ/œ, also once an accented ligature (ǽ) has lost its accent", () => {
    expect(fold("Cæcilia")).toBe("caecilia");
    expect(fold("CÆCILIA")).toBe("caecilia");
    expect(fold("Phœbe")).toBe("phoebe");
    expect(fold("Nicǽæ")).toBe("nicaeae");
  });

  it("folds a query typed with some of the marks the same as one with all or none", () => {
    const all = fold("Lê Văn Phụng");
    expect(fold("Le Văn Phung")).toBe(all);
    expect(fold("lê van phụng")).toBe(all);
    expect(fold("le van phung")).toBe(all);
  });
});
