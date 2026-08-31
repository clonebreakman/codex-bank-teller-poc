import { buildMockBankServer } from "./server.js";

const port = Number(process.env.MOCK_BANK_PORT ?? 4100);
const server = buildMockBankServer();

server
  .listen({ host: "127.0.0.1", port })
  .then(() => {
    console.log(`mock-bank listening on http://127.0.0.1:${port}`);
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await server.close();
    process.exitCode = 1;
  });

const shutdown = async () => {
  await server.close();
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
