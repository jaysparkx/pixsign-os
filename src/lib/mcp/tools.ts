import prisma from "../prisma";

// ── Tool Definitions ─────────────────────────────────────
// Each tool has: name, description, inputSchema (JSON Schema), handler

export interface McpTool {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: Record<string, any>;
        required?: string[];
    };
}

export interface ToolResult {
    content: Array<{ type: "text"; text: string }>;
    isError?: boolean;
}

// ── Tool Definitions ─────────────────────────────────────

export const TOOLS: McpTool[] = [
    {
        name: "list_documents",
        description:
            "List all documents for the authenticated user. Returns document ID, title, status, creation date, and signer count.",
        inputSchema: {
            type: "object",
            properties: {
                status: {
                    type: "string",
                    description: "Filter by status: DRAFT, SENT, PARTIALLY_SIGNED, COMPLETED, DECLINED, VOIDED, EXPIRED",
                    enum: ["DRAFT", "SENT", "PARTIALLY_SIGNED", "COMPLETED", "DECLINED", "VOIDED", "EXPIRED"],
                },
                limit: {
                    type: "number",
                    description: "Max documents to return (default 20, max 100)",
                },
            },
        },
    },
    {
        name: "get_document",
        description:
            "Get detailed information about a specific document including recipients, their signing status, and field counts.",
        inputSchema: {
            type: "object",
            properties: {
                documentId: {
                    type: "string",
                    description: "The document ID (UUID)",
                },
            },
            required: ["documentId"],
        },
    },
    {
        name: "send_for_signing",
        description:
            "Send a DRAFT document to all recipients for signing. Emails are sent to signers with their unique signing links.",
        inputSchema: {
            type: "object",
            properties: {
                documentId: {
                    type: "string",
                    description: "The document ID to send",
                },
                senderName: {
                    type: "string",
                    description: "Name to display as the sender (optional)",
                },
            },
            required: ["documentId"],
        },
    },
    {
        name: "get_signing_status",
        description:
            "Get the signing progress for a document: which recipients have signed, viewed, or are still pending.",
        inputSchema: {
            type: "object",
            properties: {
                documentId: {
                    type: "string",
                    description: "The document ID",
                },
            },
            required: ["documentId"],
        },
    },
    {
        name: "get_analytics",
        description:
            "Get analytics overview: total documents, completion rate, pending count, signer statistics, and recent activity timeline.",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
];

// ── Tool Handlers ────────────────────────────────────────

export async function handleToolCall(
    toolName: string,
    args: Record<string, any>,
    userId: string
): Promise<ToolResult> {
    switch (toolName) {
        case "list_documents":
            return handleListDocuments(userId, args);
        case "get_document":
            return handleGetDocument(userId, args);
        case "send_for_signing":
            return handleSendForSigning(userId, args);
        case "get_signing_status":
            return handleGetSigningStatus(userId, args);
        case "get_analytics":
            return handleGetAnalytics(userId);
        default:
            return { content: [{ type: "text", text: `Unknown tool: ${toolName}` }], isError: true };
    }
}

// ── Handler Implementations ──────────────────────────────

async function handleListDocuments(
    userId: string,
    args: Record<string, any>
): Promise<ToolResult> {
    const limit = Math.min(Math.max(args.limit || 20, 1), 100);
    const where: any = { userId };
    if (args.status) where.status = args.status;

    const docs = await prisma.document.findMany({
        where,
        include: { recipients: true, _count: { select: { fields: true } } },
        orderBy: { createdAt: "desc" },
        take: limit,
    });

    const result = docs.map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
        signers: d.recipients.filter((r) => r.role === "SIGNER").length,
        signed: d.recipients.filter((r) => r.status === "SIGNED").length,
        fields: d._count.fields,
    }));

    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({ documents: result, total: result.length }, null, 2),
            },
        ],
    };
}

async function handleGetDocument(
    userId: string,
    args: Record<string, any>
): Promise<ToolResult> {
    const doc = await prisma.document.findUnique({
        where: { id: args.documentId, userId },
        include: {
            recipients: true,
            _count: { select: { fields: true, events: true } },
        },
    });

    if (!doc) {
        return { content: [{ type: "text", text: "Document not found" }], isError: true };
    }

    const result = {
        id: doc.id,
        title: doc.title,
        status: doc.status,
        signingOrder: doc.signingOrder,
        message: doc.message,
        senderName: doc.senderName,
        createdAt: doc.createdAt.toISOString(),
        completedAt: doc.completedAt?.toISOString() || null,
        expiresAt: doc.expiresAt?.toISOString() || null,
        recipients: doc.recipients.map((r) => ({
            id: r.id,
            name: r.name,
            email: r.email,
            role: r.role,
            status: r.status,
            signedAt: r.signedAt?.toISOString() || null,
            viewedAt: r.viewedAt?.toISOString() || null,
        })),
        fieldCount: doc._count.fields,
        eventCount: doc._count.events,
    };

    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
}

async function handleSendForSigning(
    userId: string,
    args: Record<string, any>
): Promise<ToolResult> {
    const doc = await prisma.document.findUnique({
        where: { id: args.documentId, userId },
        include: { recipients: true, fields: true },
    });

    if (!doc) {
        return { content: [{ type: "text", text: "Document not found" }], isError: true };
    }
    if (doc.status !== "DRAFT") {
        return {
            content: [{ type: "text", text: `Cannot send: document status is ${doc.status} (must be DRAFT)` }],
            isError: true,
        };
    }

    const signers = doc.recipients.filter((r) => r.role === "SIGNER");
    if (!signers.length) {
        return {
            content: [{ type: "text", text: "Cannot send: no signers added to this document" }],
            isError: true,
        };
    }

    // Call the internal send API
    const APP = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Auto-assign unassigned fields
    const unassigned = doc.fields.filter((f) => !f.recipientId);
    if (unassigned.length > 0) {
        const defaultSigner = signers.sort((a, b) => a.signingOrder - b.signingOrder)[0];
        await prisma.field.updateMany({
            where: { id: { in: unassigned.map((f) => f.id) } },
            data: { recipientId: defaultSigner.id },
        });
    }

    const senderName = args.senderName || doc.senderName || "Document Sender";
    await prisma.document.update({ where: { id: doc.id }, data: { status: "SENT", senderName } });

    // Import email helper
    const { sendSigningRequest } = await import("../email");
    const { log } = await import("../events");
    await log(doc.id, "DOCUMENT_SENT");

    const toNotify =
        doc.signingOrder === "SEQUENTIAL"
            ? [signers.sort((a, b) => a.signingOrder - b.signingOrder)[0]]
            : signers;

    let emailsSent = 0;
    for (const r of toNotify) {
        try {
            await sendSigningRequest({
                to: r.email,
                toName: r.name,
                senderName,
                docTitle: doc.title,
                message: doc.message || undefined,
                signingUrl: `${APP}/sign/${doc.id}/${r.token}`,
                expiresAt: doc.expiresAt || undefined,
            });
            await prisma.recipient.update({
                where: { id: r.id },
                data: { status: "SENT", emailSentAt: new Date() },
            });
            emailsSent++;
        } catch (err) {
            console.error("MCP: Email failed:", err);
        }
    }

    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(
                    {
                        success: true,
                        documentId: doc.id,
                        status: "SENT",
                        emailsSent,
                        totalSigners: signers.length,
                    },
                    null,
                    2
                ),
            },
        ],
    };
}

async function handleGetSigningStatus(
    userId: string,
    args: Record<string, any>
): Promise<ToolResult> {
    const doc = await prisma.document.findUnique({
        where: { id: args.documentId, userId },
        include: { recipients: true },
    });

    if (!doc) {
        return { content: [{ type: "text", text: "Document not found" }], isError: true };
    }

    const signers = doc.recipients.filter((r) => r.role === "SIGNER");
    const signed = signers.filter((r) => r.status === "SIGNED");
    const viewed = signers.filter((r) => r.status === "VIEWED");
    const pending = signers.filter((r) => r.status === "PENDING" || r.status === "SENT");

    const result = {
        documentId: doc.id,
        title: doc.title,
        status: doc.status,
        progress: `${signed.length}/${signers.length} signed`,
        completionPercent: signers.length ? Math.round((signed.length / signers.length) * 100) : 0,
        signers: signers.map((r) => ({
            name: r.name,
            email: r.email,
            status: r.status,
            signedAt: r.signedAt?.toISOString() || null,
            viewedAt: r.viewedAt?.toISOString() || null,
        })),
        summary: {
            signed: signed.length,
            viewed: viewed.length,
            pending: pending.length,
            total: signers.length,
        },
    };

    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
}

async function handleGetAnalytics(userId: string): Promise<ToolResult> {
    const [documents, events] = await Promise.all([
        prisma.document.findMany({
            where: { userId },
            include: { recipients: true, fields: true },
        }),
        prisma.event.findMany({
            where: { document: { userId } },
            include: { recipient: true, document: { select: { title: true } } },
            orderBy: { createdAt: "desc" },
            take: 20,
        }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const doc of documents) {
        statusCounts[doc.status] = (statusCounts[doc.status] || 0) + 1;
    }

    const allSigners = documents.flatMap((d) => d.recipients.filter((r) => r.role === "SIGNER"));
    const signedSigners = allSigners.filter((r) => r.status === "SIGNED");

    const result = {
        stats: {
            totalDocuments: documents.length,
            completed: statusCounts["COMPLETED"] || 0,
            pending: (statusCounts["SENT"] || 0) + (statusCounts["PARTIALLY_SIGNED"] || 0),
            drafts: statusCounts["DRAFT"] || 0,
            totalSigners: allSigners.length,
            signedSigners: signedSigners.length,
            completionRate: allSigners.length
                ? Math.round((signedSigners.length / allSigners.length) * 100)
                : 0,
        },
        statusBreakdown: statusCounts,
        recentActivity: events.slice(0, 10).map((e) => ({
            type: e.type,
            createdAt: e.createdAt.toISOString(),
            docTitle: e.document?.title || null,
            recipient: e.recipient ? `${e.recipient.name} <${e.recipient.email}>` : null,
        })),
    };

    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
}
