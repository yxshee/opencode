import { afterAll, afterEach, describe, expect, spyOn, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { SessionPrompt } from "../../src/session/prompt"
import { MCP } from "../../src/mcp"
import { tmpdir } from "../fixture/fixture"

describe("session.prompt mcp resource uri", () => {
  const read = spyOn(MCP, "readResource")

  afterEach(() => {
    read.mockReset()
  })

  afterAll(() => {
    read.mockRestore()
  })

  test("infers MCP resource client from URI scheme when source metadata is missing", async () => {
    read.mockResolvedValueOnce({
      contents: [{ text: "tool-a\ntool-b" }],
    })

    await using tmp = await tmpdir({
      git: true,
      config: {
        agent: {
          build: {
            model: "openai/gpt-5.2",
          },
        },
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})

        const msg = await SessionPrompt.prompt({
          sessionID: session.id,
          agent: "build",
          noReply: true,
          parts: [
            { type: "text", text: "check @tools_list" },
            {
              type: "file",
              mime: "text/plain",
              filename: "tools_list",
              url: "exa://tools/list",
            },
          ],
        })

        if (msg.info.role !== "user") throw new Error("expected user message")

        expect(read).toHaveBeenCalledWith("exa", "exa://tools/list")

        const text = msg.parts
          .filter((part) => part.type === "text" && part.synthetic)
          .map((part) => part.text)
          .join("\n")
        expect(text).toContain("Reading MCP resource: tools_list (exa://tools/list)")
        expect(text).toContain("tool-a")

        await Session.remove(session.id)
      },
    })
  })
})
