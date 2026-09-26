import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/server/db/prisma", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

describe("GET /api/health", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with status ok when the DB round-trip succeeds", async () => {
    const { prisma } = await import("@/server/db/prisma");
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([{ 1: 1 }]);

    const { GET } = await import("./route");
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok", checks: { db: "ok" } });
    expect(typeof body.timestamp).toBe("string");
  });

  it("returns 503 with status down and no stack trace when the DB round-trip fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { prisma } = await import("@/server/db/prisma");
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:3306"));

    const { GET } = await import("./route");
    const res = await GET();

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({ status: "down", checks: { db: "down" } });
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
    expect(JSON.stringify(body)).not.toContain("at ");
  });
});
