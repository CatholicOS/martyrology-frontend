import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { __resetEntities, requestEntities, useEntity, usePrefetchEntities } from "@/lib/entities-client";
import { MAX_IDS, type Entity } from "@/lib/entities";

const ROME = { kind: "place", labels: { it: "Roma" }, label: "Rome", country: "IT", coords: [41.9, 12.5] } satisfies Entity;
const fetchMock = vi.fn();

function answer(entities: Record<string, Entity>) {
  return Promise.resolve(new Response(JSON.stringify({ entities }), { status: 200 }));
}

function Show({ qid }: { qid: string | null }) {
  const s = useEntity(qid);
  return <p>{s.status === "ready" ? (s.entity ? s.entity.kind : "unknown") : s.status}</p>;
}

describe("entities-client", () => {
  beforeEach(() => {
    __resetEntities();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("asks once for the items not known yet, and keeps them for the session", async () => {
    fetchMock.mockImplementation(() => answer({ Q220: ROME }));
    await requestEntities(["Q220", "Q220"]);
    await requestEntities(["Q220"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/entities?ids=Q220");
    render(<Show qid="Q220" />);
    expect(screen.getByText("place")).toBeInTheDocument();
  });

  it("asks in batches of MAX_IDS", async () => {
    fetchMock.mockImplementation(() => answer({}));
    const ids = Array.from({ length: MAX_IDS + 5 }, (_, i) => `Q${i + 1}`);
    await requestEntities(ids);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0]).split(",")).toHaveLength(MAX_IDS);
    expect(String(fetchMock.mock.calls[1][0]).split(",")).toHaveLength(5);
  });

  it("marks an item the snapshots don't know as ready without an entity", async () => {
    fetchMock.mockImplementation(() => answer({}));
    render(<Show qid="Q404" />);
    await waitFor(() => expect(screen.getByText("unknown")).toBeInTheDocument());
  });

  it("marks a failed request as an error, and asks again on retry", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockImplementationOnce(() => Promise.resolve(new Response("", { status: 502 })));
    render(<Show qid="Q220" />);
    await waitFor(() => expect(screen.getByText("error")).toBeInTheDocument());
    fetchMock.mockImplementation(() => answer({ Q220: ROME }));
    await act(() => requestEntities(["Q220"]));
    expect(screen.getByText("place")).toBeInTheDocument();
    expect(err).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });

  it("asks for nothing for a mention without an item", () => {
    render(<Show qid={null} />);
    expect(screen.getByText("idle")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tells the components showing an item when the answers are forgotten", async () => {
    fetchMock.mockImplementation(() => answer({ Q220: ROME }));
    await requestEntities(["Q220"]);
    render(<Show qid="Q220" />);
    expect(screen.getByText("place")).toBeInTheDocument();
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    act(() => __resetEntities());
    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not let a request made before the answers were forgotten write into them", async () => {
    let reply!: (r: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (reply = resolve)));
    const stale = requestEntities(["Q220"]);
    __resetEntities();
    reply(new Response(JSON.stringify({ entities: { Q220: ROME } }), { status: 200 }));
    await stale;
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    render(<Show qid="Q220" />);
    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not let a request failing after the answers were forgotten mark them as errors", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    let reply!: (r: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (reply = resolve)));
    const stale = requestEntities(["Q220"]);
    __resetEntities();
    reply(new Response("", { status: 502 }));
    await stale;
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    render(<Show qid="Q220" />);
    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it("prefetches a page's items only while the markup is on", async () => {
    fetchMock.mockImplementation(() => answer({}));
    function Page({ on }: { on: boolean }) {
      usePrefetchEntities(["Q1", "Q2"], on);
      return null;
    }
    const { rerender } = render(<Page on={false} />);
    expect(fetchMock).not.toHaveBeenCalled();
    rerender(<Page on />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/entities?ids=Q1,Q2", expect.anything()));
  });
});
