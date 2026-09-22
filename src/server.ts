import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { createMcpServer } from "./mcp.js";
import type { FetchLike } from "./todo.js";

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "127.0.0.1";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function getHostname(authority: string): string | undefined {
  try {
    return new URL(`http://${authority}`).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function isLocalRequest(req: IncomingMessage): boolean {
  const host = req.headers.host;
  return typeof host === "string" && LOCAL_HOSTNAMES.has(getHostname(host) ?? "");
}

function setCorsHeaders(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;

  let allowed = false;
  try {
    allowed = LOCAL_HOSTNAMES.has(new URL(origin).hostname.toLowerCase());
  } catch {
    allowed = false;
  }

  if (!allowed) return false;

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Mcp-Session-Id, Last-Event-ID",
  );
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  return true;
}

function sendJsonError(
  res: ServerResponse,
  status: number,
  code: number,
  message: string,
): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }));
}

export function createMcpHttpServer(fetchImpl: FetchLike = fetch) {
  return createServer(async (req, res) => {
    if (!isLocalRequest(req)) {
      sendJsonError(res, 403, -32000, "Forbidden: local Host header required.");
      return;
    }

    if (!setCorsHeaders(req, res)) {
      sendJsonError(res, 403, -32000, "Forbidden: local Origin required.");
      return;
    }

    const requestUrl = new URL(req.url ?? "/", "http://localhost");
    if (requestUrl.pathname !== "/mcp") {
      sendJsonError(res, 404, -32001, "Not found. Use /mcp.");
      return;
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const mcpServer = createMcpServer(fetchImpl);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      void transport.close();
      void mcpServer.close();
    });

    try {
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("MCPリクエストの処理に失敗しました:", error);
      if (!res.headersSent) {
        sendJsonError(res, 500, -32603, "Internal server error.");
      }
    }
  });
}

export async function startServer(
  port = Number(process.env.PORT ?? DEFAULT_PORT),
  host = DEFAULT_HOST,
): Promise<ReturnType<typeof createMcpHttpServer>> {
  const httpServer = createMcpHttpServer();

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, host, () => {
      httpServer.off("error", reject);
      resolve();
    });
  });

  console.log(`JSONPlaceholder Todo MCP server: http://localhost:${port}/mcp`);
  return httpServer;
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const httpServer = await startServer();

  const shutdown = (signal: string) => {
    console.log(`${signal}を受信しました。サーバーを終了します。`);
    httpServer.close((error) => {
      if (error) {
        console.error("サーバーの終了に失敗しました:", error);
        process.exitCode = 1;
      }
    });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}
