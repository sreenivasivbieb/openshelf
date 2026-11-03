import type { GenerateObjectArgs, LlmClient, LlmTask } from "../../src/integrations/llm/llm-client";

export interface FakeCall {
  task: LlmTask;
  system: string;
  /** The JSON inside the prompt's data block, parsed back. */
  data: unknown;
}

/** A scripted reply for one task; may throw to simulate an outage or a refusal. */
export type FakeReply = (call: FakeCall) => unknown;

/**
 * Scripted LLM for tests: no network. Replies per task, validates the reply with the task's schema like
 * the SDK does (an invalid reply throws), and records every call so tests can assert what was sent.
 * A task without a reply throws, which exercises the rule-based fallback.
 */
export function fakeLlm(
  replies: Partial<Record<LlmTask, FakeReply>> = {},
): LlmClient & { calls: FakeCall[] } {
  const calls: FakeCall[] = [];
  return {
    calls,
    async generateObject<T>(args: GenerateObjectArgs<T>): Promise<T> {
      const call: FakeCall = {
        task: args.task,
        system: args.system,
        data: parseDataBlock(args.prompt),
      };
      calls.push(call);
      const reply = replies[args.task];
      if (!reply) throw new Error(`fake LLM: no reply scripted for task "${args.task}"`);
      return args.schema.parse(await reply(call));
    },
  };
}

function parseDataBlock(prompt: string): unknown {
  const match = /^<([a-z-]+)>\n([\s\S]*)\n<\/\1>$/.exec(prompt);
  if (!match?.[2])
    throw new Error(`fake LLM: prompt is not a single data block: ${prompt.slice(0, 80)}`);
  return JSON.parse(match[2]);
}
