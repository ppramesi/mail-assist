import { LangChainTracer } from "langchain/callbacks";
import { BaseRun } from "langsmith/schemas";
import { CallbackChainTracker } from "./utils.js";

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

type Replacer = {
  lc_name?: string;
};

type PromptTemplateReplacer = Replacer & {
  type: "prompt_template_redact";
  target: string;
};

type StringReplacer = Replacer & {
  type: "string_redact";
  target: string | RegExp;
};

type TotalReplacer = Replacer & {
  type: "total_redact";
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

type RedactableCallbacks = {
  onRedaction: (
    ids: string[],
    keys: string[],
    targets: string[],
    replacements: string[],
  ) => Promise<void>;
};

export class RedactableLangChainTracer extends LangChainTracer {
  redactables: Redactables;
  /**
   * replaceWith is a function, just in case someone needs
   * to match the original text stored somewhere else through
   * callbacks with the redaction
   */
  replaceWith: () => string;
  promptValues: Map<string, Record<string, string>>;
  callbackChainTracker: CallbackChainTracker = new CallbackChainTracker();
  callbacks?: RedactableCallbacks;

  constructor(
    redactables: Redactables,
    fields: LangChainTracerFields = {},
    {
      replaceWith,
      callbacks,
    }: {
      replaceWith: string | (() => string);
      callbacks?: RedactableCallbacks;
    } = { replaceWith: "[REDACTED]" },
  ) {
    super(fields);
    this.redactables = redactables;
    if (typeof replaceWith === "string") {
      this.replaceWith = () => replaceWith;
    } else {
      this.replaceWith = replaceWith;
    }
    this.promptValues = new Map();
    this.callbacks = callbacks;
  }

  savePromptValues(run: Run) {
    if (
      this.redactables.chain &&
      this.redactables.chain.some((r) => r.type === "prompt_template_redact")
    ) {
      const runId = this.callbackChainTracker.getRootId(run.id) ?? run.id;

      const promptProps = (
        this.redactables.chain.filter(
          (r) => r.type === "prompt_template_redact",
        ) as PromptTemplateReplacer[]
      ).map((v) => v.target);
      const values: Record<string, string> = {};
      promptProps.forEach((prop) => {
        if (run.inputs[prop] && typeof run.inputs[prop] === "string") {
          values[prop] = run.inputs[prop];
        }
      });

      this.promptValues.set(runId, {
        ...values,
        ...(this.promptValues.get(runId) ?? {}), // prioritize earlier prompt values
      });
    }
  }

  redactPromptTemplate(run: Run, replacer?: PromptTemplateReplacer) {
    if (!replacer || (replacer?.lc_name && run.name !== replacer.lc_name)) {
      return run;
    }

    const clonedRun = structuredClone(run);
    const runId = this.callbackChainTracker.getRootId(run.id) ?? run.id;
    const runPromptValues = this.promptValues.get(runId);
    const redactions: {
      ids: string[];
      keys: string[];
      targets: string[];
      replacements: string[];
    } = {
      ids: [],
      keys: [],
      targets: [],
      replacements: [],
    };
    if (!runPromptValues) {
      return run;
    }
    if (run.run_type === "chain") {
      Object.entries(runPromptValues).forEach(([key, _]) => {
        const replaceWith = this.replaceWith();
        if (key in clonedRun.inputs) {
          redactions.ids.push(run.id);
          redactions.keys.push(key);
          redactions.targets.push(clonedRun.inputs[key]);
          redactions.replacements.push(replaceWith);
          clonedRun.inputs[key] = replaceWith;
        }
      });
    } else if (run.run_type === "llm") {
      const prompts = clonedRun.inputs.prompts as string[];
      clonedRun.inputs.prompts = prompts.map((prompt) => {
        return Object.keys(runPromptValues).reduce((acc, key) => {
          const replaceWith = this.replaceWith();
          redactions.ids.push(run.id);
          redactions.keys.push(key);
          redactions.targets.push(runPromptValues[key]);
          redactions.replacements.push(replaceWith);
          return acc.replaceAll(runPromptValues[key], replaceWith);
        }, prompt);
      });
    }

    this.callbacks?.onRedaction(
      redactions.ids,
      redactions.keys,
      redactions.targets,
      redactions.replacements,
    );

    return clonedRun;
  }

  redactTotal(run: Run, replacer?: TotalReplacer) {
    if (!replacer || (replacer?.lc_name && run.name !== replacer.lc_name)) {
      return run;
    }

    const redactions: {
      ids: string[];
      keys: string[];
      targets: string[];
      replacements: string[];
    } = {
      ids: [],
      keys: [],
      targets: [],
      replacements: [],
    };
    const clonedRun = structuredClone(run);
    Object.entries(clonedRun.inputs)
      .filter(([_, input]) => typeof input === "string")
      .forEach(([key, _]) => {
        const replaceWith = this.replaceWith();
        redactions.ids.push(run.id);
        redactions.keys.push(key);
        redactions.targets.push(clonedRun.inputs[key]);
        redactions.replacements.push(replaceWith);

        clonedRun.inputs[key] = replaceWith;
      });

    this.callbacks?.onRedaction(
      redactions.ids,
      redactions.keys,
      redactions.targets,
      redactions.replacements,
    );
    return clonedRun;
  }

  redactString(run: Run, replacer?: StringReplacer) {
    if (!replacer || (replacer?.lc_name && run.name !== replacer.lc_name)) {
      return run;
    }

    const redactions: {
      ids: string[];
      keys: string[];
      targets: string[];
      replacements: string[];
    } = {
      ids: [],
      keys: [],
      targets: [],
      replacements: [],
    };
    const clonedRun = structuredClone(run);
    Object.entries(clonedRun.inputs)
      .filter(([_, input]) => typeof input === "string")
      .forEach(([key, input]) => {
        const replaceWith = this.replaceWith();
        redactions.ids.push(run.id);
        redactions.keys.push(replacer.target.toString());
        redactions.targets.push(clonedRun.inputs[key]);
        redactions.replacements.push(replaceWith);

        if (typeof replacer.target === "string") {
          clonedRun.inputs[key] = input.replaceAll(
            replacer.target,
            replaceWith,
          );
        } else if (replacer.target instanceof RegExp) {
          clonedRun.inputs[key] = input.replace(replacer.target, replaceWith);
        }
      });

    this.callbacks?.onRedaction(
      redactions.ids,
      redactions.keys,
      redactions.targets,
      redactions.replacements,
    );
    return clonedRun;
  }

  async onRetrieverStart(run: Run): Promise<void> {
    this.callbackChainTracker.add(run.id, run.parent_run_id);
    const procRun = (this.redactables.retriever ?? []).reduce(
      (acc, replacer) => {
        if (replacer.type === "string_redact") {
          return this.redactString(acc, replacer);
        } else if (replacer.type === "total_redact") {
          return this.redactTotal(acc, replacer);
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
        if (replacer.type === "string_redact") {
          return this.redactString(acc, replacer);
        } else if (replacer.type === "total_redact") {
          return this.redactTotal(acc, replacer);
        }
        return acc;
      },
      run,
    );
    await super.onRetrieverEnd(procRun);
    this.callbackChainTracker.removeNode(run.id);
    this.promptValues.delete(run.id);
  }

  async onLLMStart(run: Run): Promise<void> {
    this.callbackChainTracker.add(run.id, run.parent_run_id);
    const procRun = [
      ...(this.redactables.chain ?? []),
      ...(this.redactables.llm ?? []),
    ].reduce((acc, replacer) => {
      if (replacer.type === "prompt_template_redact") {
        return this.redactPromptTemplate(acc, replacer);
      } else if (replacer.type === "string_redact") {
        return this.redactString(acc, replacer);
      } else if (replacer.type === "total_redact") {
        return this.redactTotal(acc, replacer);
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
      if (replacer.type === "prompt_template_redact") {
        return this.redactPromptTemplate(acc, replacer);
      } else if (replacer.type === "string_redact") {
        return this.redactString(acc, replacer);
      } else if (replacer.type === "total_redact") {
        return this.redactTotal(acc, replacer);
      }
      return acc;
    }, run);
    await super.onLLMEnd(procRun);
    this.callbackChainTracker.removeNode(run.id);
    this.promptValues.delete(run.id);
  }

  async onChainStart(run: Run): Promise<void> {
    this.callbackChainTracker.add(run.id, run.parent_run_id);
    this.savePromptValues(run);
    const procRun = (this.redactables.chain ?? []).reduce((acc, replacer) => {
      if (replacer.type === "prompt_template_redact") {
        return this.redactPromptTemplate(acc, replacer);
      } else if (replacer.type === "string_redact") {
        return this.redactString(acc, replacer);
      } else if (replacer.type === "total_redact") {
        return this.redactTotal(acc, replacer);
      }
      return acc;
    }, run);
    await super.onChainStart(procRun);
  }

  async onChainEnd(run: Run): Promise<void> {
    const procRun = (this.redactables.chain ?? []).reduce((acc, replacer) => {
      if (replacer.type === "prompt_template_redact") {
        return this.redactPromptTemplate(acc, replacer);
      } else if (replacer.type === "string_redact") {
        return this.redactString(acc, replacer);
      } else if (replacer.type === "total_redact") {
        return this.redactTotal(acc, replacer);
      }
      return acc;
    }, run);
    await super.onChainEnd(procRun);
    this.callbackChainTracker.removeNode(run.id);
    this.promptValues.delete(run.id);
  }

  async onToolStart(run: Run): Promise<void> {
    this.callbackChainTracker.add(run.id, run.parent_run_id);
    const procRun = (this.redactables.tool ?? []).reduce((acc, replacer) => {
      if (replacer.type === "string_redact") {
        return this.redactString(acc, replacer);
      } else if (replacer.type === "total_redact") {
        return this.redactTotal(acc, replacer);
      }
      return acc;
    }, run);
    await super.onToolStart(procRun);
  }

  async onToolEnd(run: Run): Promise<void> {
    const procRun = (this.redactables.tool ?? []).reduce((acc, replacer) => {
      if (replacer.type === "string_redact") {
        return this.redactString(acc, replacer);
      } else if (replacer.type === "total_redact") {
        return this.redactTotal(acc, replacer);
      }
      return acc;
    }, run);
    await super.onToolEnd(procRun);
    this.callbackChainTracker.removeNode(run.id);
    this.promptValues.delete(run.id);
  }
}
