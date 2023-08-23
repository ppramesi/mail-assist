import { LangChainTracer } from "langchain/callbacks";
import { BaseRun } from "langsmith/schemas";
import { Client } from "langsmith"

interface BaseCallbackHandlerInput {
  ignoreLLM?: boolean;
  ignoreChain?: boolean;
  ignoreAgent?: boolean;
  ignoreRetriever?: boolean;
}

interface LangChainTracerFields extends BaseCallbackHandlerInput {
  exampleId?: string;
  projectName?: string;
}

interface Run extends BaseRun {
  id: string;
  child_runs: this[];
  child_execution_order: number;
}

type PromptTemplateReplacer = {
  type: "prompt_template";
  target: string;
};

type StringReplacer = {
  type: "string_replace";
  target: string | RegExp;
};

type TotalReplacer = {
  type: "total";
};

type ChainRedactables = (
  | PromptTemplateReplacer
  | StringReplacer
  | TotalReplacer
)[];

type RetrieverRedactables = (StringReplacer | TotalReplacer)[];

type LLMRedactables = (StringReplacer | TotalReplacer)[];

type ToolRedactables = (StringReplacer | TotalReplacer)[];

type Redactables = {
  chain?: ChainRedactables;
  retriever?: RetrieverRedactables;
  llm?: LLMRedactables;
  tool?: ToolRedactables;
};

export class RedactableLangChainTracer extends LangChainTracer {
  redactables: Redactables;
  replacedWith: string;
  promptValues: Map<string, Record<string, string>>;

  constructor(
    redactables: Redactables,
    fields: LangChainTracerFields = {},
    { replacedWith }: { replacedWith: string } = { replacedWith: "[REDACTED]" },
  ) {
    super(fields);
    this.redactables = redactables;
    this.replacedWith = replacedWith;
    this.promptValues = new Map();
    this.client = new Client({
      apiUrl: process.env.REDACTABLE_LANGSMITH_ENDPOINT,
      apiKey: process.env.REDACTABLE_LANGSMITH_API_KEY
    }) as any
  }

  savePromptValues(run: Run) {
    if (
      this.redactables.chain &&
      this.redactables.chain.some((r) => r.type === "prompt_template")
    ) {
      const promptProps = (
        this.redactables.chain.filter(
          (r) => r.type === "prompt_template",
        ) as PromptTemplateReplacer[]
      ).map((v) => v.target);
      const values: Record<string, string> = {};
      promptProps.forEach((prop) => {
        if (run.inputs[prop] && typeof run.inputs[prop] === "string") {
          values[prop] = run.inputs[prop];
        }
      });
      this.promptValues.set(run.id, {
        ...(this.promptValues.get(run.id) ?? {}),
        ...values,
      });
    }
  }

  replacePromptTemplate(run: Run, replacer?: PromptTemplateReplacer) {
    if(!replacer){
      return run;
    }

    const clonedRun = structuredClone(run);
    if (run.run_type === "chain") {
      const runPromptValues = this.promptValues.get(run.id);
      if (!runPromptValues) {
        return run;
      }
      Object.entries(runPromptValues).forEach(([key, _]) => {
        if (key in clonedRun.inputs) {
          clonedRun.inputs[key] = this.replacedWith;
        }
      });
    } else if (run.run_type === "llm") {
      if(!run.parent_run_id){
        return run;
      }
      const runPromptValues = this.promptValues.get(run.parent_run_id);
      if (!runPromptValues) {
        return run;
      }
      const prompts = clonedRun.inputs.prompts as string[];
      clonedRun.inputs.prompts = prompts.map((prompt) => {
        return Object.keys(runPromptValues).reduce((acc, key) => {
          return acc.replaceAll(runPromptValues[key], this.replacedWith);
        }, prompt);
      });
    }

    return clonedRun;
  }

  replaceTotal(run: Run, replacer?: TotalReplacer) {
    if (!replacer) {
      return run;
    }
    const clonedRun = structuredClone(run);
    Object.entries(clonedRun.inputs)
      .filter(([_, input]) => typeof input === "string")
      .forEach(([key, _]) => {
        clonedRun.inputs[key] = this.replacedWith;
      });
    return clonedRun;
  }

  replaceString(run: Run, replacer?: StringReplacer) {
    if (!replacer) {
      return run;
    }
    const clonedRun = structuredClone(run);
    Object.entries(clonedRun.inputs)
      .filter(([_, input]) => typeof input === "string")
      .forEach(([key, input]) => {
        if (typeof replacer.target === "string") {
          clonedRun.inputs[key] = input.replaceAll(
            replacer.target,
            this.replacedWith,
          );
        } else if (replacer.target instanceof RegExp) {
          clonedRun.inputs[key] = input.replace(
            replacer.target,
            this.replacedWith,
          );
        }
      });

    clonedRun.outputs;

    return clonedRun;
  }

  async onRetrieverStart(run: Run): Promise<void> {
    const procRun = (this.redactables.retriever ?? []).reduce(
      (acc, replacer) => {
        if (replacer.type === "string_replace") {
          return this.replaceString(acc, replacer);
        } else if (replacer.type === "total") {
          return this.replaceTotal(acc, replacer);
        }
        return acc;
      },
      run,
    );
    await super.onRetrieverStart(procRun);
  }

  async onRetrieverEnd(run: Run): Promise<void> {
    const procRun = (this.redactables.retriever ?? []).reduce(
      (acc, replacer) => {
        if (replacer.type === "string_replace") {
          return this.replaceString(acc, replacer);
        } else if (replacer.type === "total") {
          return this.replaceTotal(acc, replacer);
        }
        return acc;
      },
      run,
    );
    await super.onRetrieverEnd(procRun);
  }

  async onLLMStart(run: Run): Promise<void> {
    const procRun = [
      ...(this.redactables.chain ?? []),
      ...(this.redactables.llm ?? []),
    ].reduce((acc, replacer) => {
      if (replacer.type === "prompt_template") {
        return this.replacePromptTemplate(acc, replacer);
      } else if (replacer.type === "string_replace") {
        return this.replaceString(acc, replacer);
      } else if (replacer.type === "total") {
        return this.replaceTotal(acc, replacer);
      }
      return acc;
    }, run);
    await super.onLLMStart(procRun);
  }

  async onLLMEnd(run: Run): Promise<void> {
    const procRun = [
      ...(this.redactables.chain ?? []),
      ...(this.redactables.llm ?? []),
    ].reduce((acc, replacer) => {
      if (replacer.type === "prompt_template") {
        return this.replacePromptTemplate(acc, replacer);
      } else if (replacer.type === "string_replace") {
        return this.replaceString(acc, replacer);
      } else if (replacer.type === "total") {
        return this.replaceTotal(acc, replacer);
      }
      return acc;
    }, run);
    await super.onLLMEnd(procRun);
  }

  async onChainStart(run: Run): Promise<void> {
    this.savePromptValues(run);
    const procRun = (this.redactables.chain ?? []).reduce((acc, replacer) => {
      if (replacer.type === "prompt_template") {
        return this.replacePromptTemplate(acc, replacer);
      } else if (replacer.type === "string_replace") {
        return this.replaceString(acc, replacer);
      } else if (replacer.type === "total") {
        return this.replaceTotal(acc, replacer);
      }
      return acc;
    }, run);
    await super.onChainStart(procRun);
  }

  async onChainEnd(run: Run): Promise<void> {
    const procRun = (this.redactables.chain ?? []).reduce((acc, replacer) => {
      if (replacer.type === "prompt_template") {
        return this.replacePromptTemplate(acc, replacer);
      } else if (replacer.type === "string_replace") {
        return this.replaceString(acc, replacer);
      } else if (replacer.type === "total") {
        return this.replaceTotal(acc, replacer);
      }
      return acc;
    }, run);
    await super.onChainEnd(procRun);
  }

  async onToolStart(run: Run): Promise<void> {
    const procRun = (this.redactables.tool ?? []).reduce((acc, replacer) => {
      if (replacer.type === "string_replace") {
        return this.replaceString(acc, replacer);
      } else if (replacer.type === "total") {
        return this.replaceTotal(acc, replacer);
      }
      return acc;
    }, run);
    await super.onToolStart(procRun);
  }

  async onToolEnd(run: Run): Promise<void> {
    const procRun = (this.redactables.tool ?? []).reduce((acc, replacer) => {
      if (replacer.type === "string_replace") {
        return this.replaceString(acc, replacer);
      } else if (replacer.type === "total") {
        return this.replaceTotal(acc, replacer);
      }
      return acc;
    }, run);
    await super.onToolEnd(procRun);
  }
}
