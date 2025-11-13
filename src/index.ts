import fs from "node:fs"
import { version } from "../package.json"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import z from "zod"
import { query } from "@anthropic-ai/claude-agent-sdk"

const server = new McpServer(
  {
    name: "claude-code-mcp",
    version,
  },
  {
    capabilities: {
      logging: {},
    },
  },
)

server.registerTool(
  "run_claude_code",
  {
    title: "Run Claude Code",
    description: "Run Claude Code agent to complete a task",
    inputSchema: {
      task: z
        .string()
        .describe("The task to delegate, keep it close to original user query"),
      cwd: z
        .string()
        .describe(
          "The working directory to run the Claude Code, must be an absolute path",
        ),
      sessionId: z
        .string()
        .optional()
        .describe("Continue in a previous session"),
    },
  },
  async ({ task, cwd, sessionId }) => {
    if (!fs.existsSync(cwd)) {
      throw new Error(`Directory ${cwd} does not exist`)
    }

    let result:
      | {
          result: string
          session_id: string
          total_cost_usd: number
        }
      | undefined

    for await (const message of query({
      prompt: task,
      options: {
        permissionMode: "acceptEdits",
        cwd,
        resume: sessionId,
      },
    })) {
      await server.sendLoggingMessage({
        level: "info",
        data: `${JSON.stringify(message)}`,
      })

      if (message.type === "result") {
        result = {
          // @ts-expect-error exist but somehow the sdk doesn't expose it
          result: message.result,
          session_id: message.session_id,
          total_cost_usd: message.total_cost_usd,
        }
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result),
        },
      ],
    }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
