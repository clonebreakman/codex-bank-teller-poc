import { afterEach, describe, expect, it } from "vitest";
import { buildMockBankServer } from "./server.js";

describe("mock bank HTTP API", () => {
  const servers = [] as Awaited<ReturnType<typeof buildMockBankServer>>[];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  it("exposes a synthetic-only health check", async () => {
    const server = buildMockBankServer();
    servers.push(server);

    const response = await server.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      syntheticOnly: true,
      synthetic: true,
    });
  }, 15000);

  it("returns only the verified balance fields for a known account", async () => {
    const server = buildMockBankServer({
      now: () => "2026-08-22T00:00:00.000Z",
    });
    servers.push(server);

    const response = await server.inject({
      method: "GET",
      url: "/v1/accounts/ACC-1001/balance",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      accountId: "ACC-1001",
      currency: "USD",
      balanceMinor: 125000,
      asOf: "2026-08-22T00:00:00.000Z",
      synthetic: true,
    });
    expect(response.json().request_id).toBe("REQ-0001");
  });

  it("returns a structured not-found response without guessing", async () => {
    const server = buildMockBankServer();
    servers.push(server);

    const response = await server.inject({
      method: "GET",
      url: "/v1/accounts/ACC-9999/balance",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      code: "ACCOUNT_NOT_FOUND",
      message: "Synthetic account was not found",
    });
    expect(response.json().request_id).toBe("REQ-0001");
  });

  it("returns bounded transactions, receipts, and tickets", async () => {
    const server = buildMockBankServer();
    servers.push(server);

    const transactions = await server.inject({
      method: "GET",
      url: "/v1/accounts/ACC-1001/transactions?limit=10",
    });
    const receipt = await server.inject({
      method: "GET",
      url: "/v1/receipts/REC-1001",
    });
    const ticket = await server.inject({
      method: "GET",
      url: "/v1/tickets/TKT-1001",
    });

    expect(transactions.statusCode).toBe(200);
    expect(transactions.json().transactions).toHaveLength(10);
    expect(transactions.json().transactions[0]).toMatchObject({ synthetic: true });
    expect(receipt.statusCode).toBe(200);
    expect(receipt.json()).toMatchObject({ receiptId: "REC-1001", synthetic: true });
    expect(ticket.statusCode).toBe(200);
    expect(ticket.json()).toMatchObject({ ticketId: "TKT-1001", synthetic: true });
  });

  it("rejects a mismatched customer identity", async () => {
    const server = buildMockBankServer();
    servers.push(server);

    const response = await server.inject({
      method: "GET",
      url: "/v1/accounts/ACC-1001/balance?customerId=CUST-9999",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      code: "IDENTITY_MISMATCH",
      message: "Synthetic customer does not own this account",
    });
    expect(response.json().request_id).toBe("REQ-0001");
  });
});
