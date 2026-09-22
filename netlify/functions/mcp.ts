import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Config } from "@netlify/functions";

import { createMcpServer } from "../../src/mcp.js";
import type { FetchLike } from "../../src/todo.js";

const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function jsonRpcError(status: number, code: number, message: string): Response {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }),
    { status, headers: JSON_HEADERS },
  );
}

export function createNetlifyMcpHandler(fetchImpl: FetchLike = fetch) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      const response = jsonRpcError(405, -32000, "Method not allowed. Use POST /mcp.");
      response.headers.set("Allow", "POST");
      return response;
    }

    const server = createMcpServer(fetchImpl);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    try {
      await server.connect(transport);
      const response = await transport.handleRequest(request);
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch (error) {
      const detail =
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { name: "UnknownError", message: String(error) };
      console.error("Netlify MCP request failed:", detail);
      return jsonRpcError(500, -32603, "Internal server error.");
    }
  };
}

const handler = createNetlifyMcpHandler();

export default handler;

export const config: Config = {
  path: "/mcp",
  rateLimit: {
    windowSize: 60,
    windowLimit: 100,
    aggregateBy: ["ip"],
  },
};
