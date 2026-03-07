import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/mcp/auth";
import { TOOLS, handleToolCall } from "@/lib/mcp/tools";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * MCP JSON-RPC 2.0 Endpoint
 *
 * Supports: initialize, tools/list, tools/call
 * Auth: Bearer token (API key)
 */
export async function POST(req: NextRequest) {
    // ── Auth ──
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return jsonRpcError(null, -32000, "Missing or invalid Authorization header. Use: Bearer pk_xxx");
    }

    const apiKey = authHeader.slice(7);
    const auth = await validateApiKey(apiKey);
    if (!auth) {
        return jsonRpcError(null, -32001, "Invalid or expired API key");
    }

    // ── Parse JSON-RPC ──
    let body: any;
    try {
        body = await req.json();
    } catch {
        return jsonRpcError(null, -32700, "Parse error");
    }

    const { jsonrpc, id, method, params } = body;

    if (jsonrpc !== "2.0") {
        return jsonRpcError(id, -32600, "Invalid Request: must use jsonrpc 2.0");
    }

    // ── Route Methods ──
    switch (method) {
        case "initialize":
            return jsonRpcSuccess(id, {
                protocolVersion: "2024-11-05",
                capabilities: { tools: {}, resources: {} },
                serverInfo: {
                    name: "pixsign-mcp",
                    version: "1.0.0",
                    description: "PixSign e-signing platform — manage documents, signers, and analytics via AI",
                },
            });

        case "tools/list":
            return jsonRpcSuccess(id, { tools: TOOLS });

        case "tools/call": {
            const { name, arguments: args } = params || {};
            if (!name) {
                return jsonRpcError(id, -32602, "Missing tool name in params.name");
            }

            const tool = TOOLS.find((t) => t.name === name);
            if (!tool) {
                return jsonRpcError(id, -32602, `Unknown tool: ${name}`);
            }

            const start = Date.now();
            let result;
            let status = "success";
            let error: string | undefined;

            try {
                result = await handleToolCall(name, args || {}, auth.userId);
                if (result.isError) {
                    status = "error";
                    error = result.content[0]?.text;
                }
            } catch (err: any) {
                status = "error";
                error = err.message || "Internal error";
                result = { content: [{ type: "text" as const, text: `Error: ${error}` }], isError: true };
            }

            const durationMs = Date.now() - start;

            // Log the call (fire-and-forget)
            prisma.mcpLog
                .create({
                    data: {
                        apiKeyId: auth.apiKeyId,
                        tool: name,
                        params: args ? JSON.stringify(args) : null,
                        status,
                        durationMs,
                        error: error || null,
                    },
                })
                .catch(() => { });

            return jsonRpcSuccess(id, result);
        }

        case "resources/list":
            return jsonRpcSuccess(id, { resources: [] });

        case "resources/read":
            return jsonRpcError(id, -32601, "No resources available yet");

        default:
            return jsonRpcError(id, -32601, `Method not found: ${method}`);
    }
}

// Also support GET for health check / server info
export async function GET() {
    return NextResponse.json({
        name: "pixsign-mcp",
        version: "1.0.0",
        protocol: "MCP (Model Context Protocol)",
        description: "PixSign e-signing platform MCP server",
        docs: "https://modelcontextprotocol.io",
    });
}

// ── Helpers ──

function jsonRpcSuccess(id: any, result: any) {
    return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function jsonRpcError(id: any, code: number, message: string) {
    return NextResponse.json(
        { jsonrpc: "2.0", id, error: { code, message } },
        { status: code === -32000 || code === -32001 ? 401 : 200 }
    );
}
