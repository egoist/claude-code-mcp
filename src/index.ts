import fs from "node:fs"
import { spawn } from "node:child_process"
import { version } from "../package.json"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import z from "zod"

const server = new McpServer(
  {
    name: "gemini-cli-mcp",
    version,
  },
  {
    capabilities: {
      logging: {},
    },
  }
)

interface GeminiStreamEvent {
  type: string
  text?: string
  toolName?: string
  args?: unknown
  result?: string
  error?: string
}

async function runGeminiCLI(
  task: string,
  cwd: string,
  historyId?: string
): Promise<{ result: string; historyId?: string }> {
  const args = ["-p", task, "--output-format", "stream-json"]

  if (historyId) {
    args.push("--history-id", historyId)
  }

  return new Promise((resolve, reject) => {
    const gemini = spawn("gemini", args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""
    let lastText = ""
    let currentHistoryId: string | undefined

    gemini.stdout.on("data", (data) => {
      const chunk = data.toString()
      stdout += chunk

      // Process newline-delimited JSON events
      const lines = chunk.split("\n").filter((line: string) => line.trim())
      for (const line of lines) {
        try {
          const event: GeminiStreamEvent = JSON.parse(line)

          server.sendLoggingMessage({
            level: "info",
            data: `${line}`,
          })

          if (event.type === "text" && event.text) {
            lastText += event.text
          } else if (event.type === "historyId") {
            currentHistoryId = event.result
          }
        } catch (e) {
          // Ignore JSON parse errors for partial lines
        }
      }
    })

    gemini.stderr.on("data", (data) => {
      stderr += data.toString()
      server.sendLoggingMessage({
        level: "error",
        data: data.toString(),
      })
    })

    gemini.on("close", (code) => {
      if (code === 0) {
        resolve({
          result: lastText || stdout,
          historyId: currentHistoryId,
        })
      } else {
        reject(
          new Error(`Gemini CLI exited with code ${code}. Error: ${stderr}`)
        )
      }
    })

    gemini.on("error", (error) => {
      reject(new Error(`Failed to spawn Gemini CLI: ${error.message}`))
    })
  })
}

server.registerTool(
  "task",
  {
    title: "New task",
    description: "Run Gemini CLI agent to complete a task",
    inputSchema: {
      task: z
        .string()
        .describe("The task to delegate, keep it close to original user query"),
      cwd: z
        .string()
        .describe(
          "The working directory to run the Gemini CLI, must be an absolute path"
        ),
      historyId: z
        .string()
        .optional()
        .describe("Continue in a previous conversation history"),
    },
  },
  async ({ task, cwd, historyId }) => {
    if (!fs.existsSync(cwd)) {
      throw new Error(`Directory ${cwd} does not exist`)
    }

    try {
      const result = await runGeminiCLI(task, cwd, historyId)

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
        _meta: {
          chatwise: {
            // do not submit again since we can just display the response directly
            stop: true,
            // the markdown to display after the tool result
            markdown: result.result || "",
          },
        },
      }
    } catch (error) {
      throw new Error(
        `Failed to run Gemini CLI: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
