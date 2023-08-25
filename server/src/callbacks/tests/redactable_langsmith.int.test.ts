import { test } from "@jest/globals";
import { IntentionsGenerator } from "../../chains/generators/intentions_generator.js";
import {
  PromptTemplateRedactor,
  RedactableLangChainTracer,
  TotalRedactor,
} from "../redactable_langsmith.js";
import { ChatOpenAI } from "langchain/chat_models/openai";

test("Total Redaction", async () => {
  const tracer = new RedactableLangChainTracer([
    new TotalRedactor({
      // replaceTargets: ["body"],
      chainTargets: ["chain", "llm"],
    }),
  ]);

  const generator = new IntentionsGenerator({
    llm: new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
    }),
  });
  generator.setContext({ "My name": "Shake Zula", "My Job": "The mic rula" });
  const values = {
    body: `asdfasdfasdf
    asdfasdf
    xzcvzxcvzxcv
    wertwertwertwert
    235235234`, // body should be redacted
    from: ["test@test.com <tester tester>"].join("\n"),
    delivery_date: new Date().toLocaleDateString(),
    to: ["hello@hello.com", "hi@hi.com"].join("\n"),
    cc: ["huh@huh.com"],
  };

  const result = await generator.call(values, { callbacks: [tracer] });
  console.log(result);
});

test("Prompt Redaction", async () => {
  const tracer = new RedactableLangChainTracer([
    new PromptTemplateRedactor({
      replaceTargets: ["body"],
      chainTargets: ["chain", "llm"],
    }),
  ]);

  const generator = new IntentionsGenerator({
    llm: new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
    }),
  });
  generator.setContext({ "My name": "Shake Zula", "My Job": "The mic rula" });
  const values = {
    body: `asdfasdfasdf
    asdfasdf
    xzcvzxcvzxcv
    wertwertwertwert
    235235234`, // body should be redacted
    from: ["test@test.com <tester tester>"].join("\n"),
    delivery_date: new Date().toLocaleDateString(),
    to: ["hello@hello.com", "hi@hi.com"].join("\n"),
    cc: ["huh@huh.com"],
  };

  const result = await generator.call(values, { callbacks: [tracer] });
  console.log(result);
});