import Fastify, { type FastifyInstance } from "fastify";
import { MockBankService, type MockBankServiceOptions } from "./service.js";

interface RequestQuery {
  customerId?: string;
  limit?: string;
}

export function buildMockBankServer(
  options: MockBankServiceOptions = {},
): FastifyInstance {
  const server = Fastify({ logger: false });
  const service = new MockBankService(options);
  let requestSequence = 0;
  const requestId = () => `REQ-${String(++requestSequence).padStart(4, "0")}`;

  const health = async () => ({
    status: "ok",
    syntheticOnly: true,
    synthetic: true,
  });
  server.get("/health", health);
  server.get("/v1/health", health);

  server.get<{ Params: { accountId: string }; Querystring: RequestQuery }>(
    "/v1/accounts/:accountId/balance",
    async (request, reply) => {
      const currentRequestId = requestId();
      try {
        return {
          ...service.getAccountBalance(
            request.params.accountId,
            request.query.customerId,
          ),
          request_id: currentRequestId,
        };
      } catch (error) {
        return sendServiceError(reply, error, currentRequestId);
      }
    },
  );

  server.get<{ Params: { accountId: string }; Querystring: RequestQuery }>(
    "/v1/accounts/:accountId/transactions",
    async (request, reply) => {
      const currentRequestId = requestId();
      try {
        return {
          transactions: service.listTransactions(
            request.params.accountId,
            request.query.limit === undefined
              ? 10
              : Number(request.query.limit),
            request.query.customerId,
          ),
          request_id: currentRequestId,
          synthetic: true,
        };
      } catch (error) {
        return sendServiceError(reply, error, currentRequestId);
      }
    },
  );

  server.get<{ Params: { receiptId: string } }>(
    "/v1/receipts/:receiptId",
    async (request, reply) => {
      const currentRequestId = requestId();
      try {
        return {
          ...service.getReceipt(request.params.receiptId),
          request_id: currentRequestId,
        };
      } catch (error) {
        return sendServiceError(reply, error, currentRequestId);
      }
    },
  );

  server.get<{ Params: { ticketId: string } }>(
    "/v1/tickets/:ticketId",
    async (request, reply) => {
      const currentRequestId = requestId();
      try {
        return {
          ...service.getTicket(request.params.ticketId),
          request_id: currentRequestId,
        };
      } catch (error) {
        return sendServiceError(reply, error, currentRequestId);
      }
    },
  );

  return server;
}

function sendServiceError(
  reply: { status: (code: number) => { send: (payload: unknown) => unknown } },
  error: unknown,
  requestId: string,
): unknown {
  const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
  const errors: Record<string, { status: number; message: string }> = {
    ACCOUNT_NOT_FOUND: {
      status: 404,
      message: "Synthetic account was not found",
    },
    RECEIPT_NOT_FOUND: {
      status: 404,
      message: "Synthetic receipt was not found",
    },
    TICKET_NOT_FOUND: {
      status: 404,
      message: "Synthetic ticket was not found",
    },
    IDENTITY_MISMATCH: {
      status: 403,
      message: "Synthetic customer does not own this account",
    },
  };
  const mapped = errors[code] ?? {
    status: 500,
    message: "Synthetic bank service failed",
  };

  return reply.status(mapped.status).send({
    code,
    message: mapped.message,
    request_id: requestId,
    synthetic: true,
  });
}
