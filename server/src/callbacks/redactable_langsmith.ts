import { LangChainTracer } from "langchain/callbacks";
import { BaseRun, KVMap, RunType } from "langsmith/schemas";
import { CallbackChainTracker } from "./utils.js";
import cloneDeep from "lodash/cloneDeep.js";
import { Client } from "langsmith";
import { BaseMessage, Generation } from "langchain/schema";

type PartialRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

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

type RedactorCallbacks = {
  onRedaction: (
    ids: string[],
    keys: string[],
    targets: string[],
    replacements: string[],
  ) => Promise<void>;
};

export type RedactorOpts<T> = {
  replaceTargets?: T[];
  chainTargets?: RedactorChainTypes[];
  lc_name?: string;
  replaceWith?: string | (() => string);
  callbacks?: RedactorCallbacks;
};

type RedactorChainTypes = Exclude<RunType, "embedding" | "prompt" | "parser">;

export abstract class Redactor {
  declare TargetType: any;
  replaceTargets?: this["TargetType"][];
  chainTargets?: RedactorChainTypes[];
  lc_name?: string;
  callbacks?: RedactorCallbacks;
  replaceWith: () => string;
  constructor({
    replaceTargets,
    chainTargets,
    lc_name,
    replaceWith,
    callbacks,
  }: RedactorOpts<any>) {
    this.replaceTargets = replaceTargets;
    this.chainTargets = chainTargets;
    this.lc_name = lc_name;
    this.replaceWith = replaceWith
      ? typeof replaceWith === "string"
        ? () => replaceWith
        : replaceWith
      : () => "[REDACTED]";
    this.callbacks = callbacks;
  }
  abstract redactInput(run: Run): Run;
  abstract redactOutput(run: Run): Run;
  abstract onStart(run: Run): Run;
  abstract onEnd(run: Run): Run;

  setReplaceWith(replaceWith: string | (() => string) = "[REDACTED]") {
    this.replaceWith =
      typeof replaceWith === "string" ? () => replaceWith : replaceWith;
  }

  setCallbacks(callbacks?: RedactorCallbacks) {
    this.callbacks = callbacks;
  }
}

export class PromptTemplateRedactor extends Redactor {
  declare TargetType: string;
  callbackChainTracker: CallbackChainTracker = new CallbackChainTracker();
  promptValues: Map<string, Record<string, string>>;
  constructor(opts: PartialRequired<RedactorOpts<PromptTemplateRedactor["TargetType"]>, "replaceTargets">) {
    super(opts);
    this.promptValues = new Map();
  }

  redactInput(run: Run): Run {
    if (
      (this.chainTargets &&
        this.chainTargets.length > 0 &&
        !this.chainTargets.includes(run.run_type as RedactorChainTypes)) ||
      !this.replaceTargets ||
      this.replaceTargets.length === 0 ||
      (this?.lc_name && run.name !== this.lc_name)
    ) {
      return run;
    }

    const clonedRun = cloneDeep(run);
    const runId = this.callbackChainTracker.getRootId(run.id) ?? run.id;
    const runPromptValues = this.promptValues.get(runId);
    if (!runPromptValues) {
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
      if ("prompts" in clonedRun.inputs) {
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
      } else if ("messages" in clonedRun.inputs) {
        const messages = clonedRun.inputs.messages as BaseMessage[][];
        messages.forEach((v, k) => {
          v.forEach((_, ik) => {
            clonedRun.inputs.messages[k][ik].content = Object.keys(
              runPromptValues,
            ).reduce((acc, key) => {
              const replaceWith = this.replaceWith();
              redactions.ids.push(run.id);
              redactions.keys.push(key);
              redactions.targets.push(runPromptValues[key]);
              redactions.replacements.push(replaceWith);
              return acc.replaceAll(runPromptValues[key], replaceWith);
            }, clonedRun.inputs.messages[k][ik].content);
          });
        });
      }
    }

    this.callbacks?.onRedaction(
      redactions.ids,
      redactions.keys,
      redactions.targets,
      redactions.replacements,
    );

    return clonedRun;
  }

  redactOutput(run: Run): Run {
    return run;
  }

  onStart(run: Run): Run {
    if (run.run_type === "chain") {
      if (this.replaceTargets && this.replaceTargets.length > 0) {
        const runId = this.callbackChainTracker.getRootId(run.id) ?? run.id;
        const values: Record<string, string> = {};
        this.replaceTargets.forEach((prop) => {
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
    this.callbackChainTracker.add(run.id, run.parent_run_id);
    return run;
  }

  onEnd(run: Run): Run {
    this.callbackChainTracker.removeNode(run.id);
    this.promptValues.delete(run.id);
    return run;
  }
}

export class TotalRedactor extends Redactor {
  declare TargetType: "total";
  redactInput(run: Run): Run {
    if (
      (this.chainTargets &&
        this.chainTargets.length > 0 &&
        !this.chainTargets.includes(run.run_type as RedactorChainTypes)) ||
      (this?.lc_name && run.name !== this.lc_name)
    ) {
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
    const clonedRun = cloneDeep(run);

    if (run.run_type === "llm") {
      if ("prompts" in clonedRun.inputs) {
        const prompts = clonedRun.inputs.prompts as string[];
        clonedRun.inputs.prompts = prompts.map((_) => {
          const replaceWith = this.replaceWith();
          redactions.ids.push(run.id);
          redactions.keys.push("prompts");
          redactions.targets.push(clonedRun.inputs["prompts"]);
          redactions.replacements.push(replaceWith);
          return replaceWith;
        });
      } else if ("messages" in clonedRun.inputs) {
        const messages = clonedRun.inputs.messages as BaseMessage[][];
        messages.forEach((v, k) => {
          v.forEach((_, ik) => {
            const replaceWith = this.replaceWith();
            redactions.ids.push(run.id);
            redactions.keys.push(`clonedRun.inputs.messages[${k}][${ik}]`);
            redactions.targets.push(clonedRun.inputs.messages[k][ik].content);
            redactions.replacements.push(replaceWith);
            clonedRun.inputs.messages[k][ik].content = replaceWith;
          });
        });
      }
    } else {
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
    }

    this.callbacks?.onRedaction(
      redactions.ids,
      redactions.keys,
      redactions.targets,
      redactions.replacements,
    );
    return clonedRun;
  }

  redactOutput(run: Run): Run {
    if (
      (this.chainTargets &&
        this.chainTargets.length > 0 &&
        !this.chainTargets.includes(run.run_type as RedactorChainTypes)) ||
      !run.outputs ||
      (this?.lc_name && run.name !== this.lc_name)
    ) {
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
    const clonedRun = cloneDeep(run);

    if (run.run_type === "llm") {
      if ("generations" in run.outputs) {
        run.outputs.generations.forEach(
          (generation: Generation[], k: number) => {
            generation.forEach((_, ik) => {
              const replaceWith = this.replaceWith();
              redactions.ids.push(run.id);
              redactions.keys.push(
                `clonedRun.outputs.generations[${k}][${ik}]`,
              );
              const source = clonedRun.outputs!.generations[k][ik];
              redactions.targets.push(source.text);
              redactions.replacements.push(replaceWith);
              source.text = replaceWith;
              if (
                source?.message?.additional_kwargs?.function_call?.arguments
              ) {
                source.message.additional_kwargs.function_call.arguments =
                  replaceWith;
              }
            });
          },
        );
      }
    } else {
      const redactHelper = (kvMap: KVMap, path: string) => {
        Object.keys(kvMap).forEach((key) => {
          const newPath = path ? `${path}.${key}` : key;
          if (typeof kvMap[key] === "string") {
            const replaceWith = this.replaceWith();
            redactions.ids.push(run.id);
            redactions.keys.push(newPath);
            redactions.targets.push(kvMap[key]);
            redactions.replacements.push(replaceWith);
            kvMap[key] = replaceWith;
          } else if (typeof kvMap[key] === "object") {
            redactHelper(kvMap[key], newPath);
          }
        });
      };
      redactHelper(clonedRun.outputs!, "");
    }

    this.callbacks?.onRedaction(
      redactions.ids,
      redactions.keys,
      redactions.targets,
      redactions.replacements,
    );
    return clonedRun;
  }

  onStart(run: Run): Run {
    return run;
  }

  onEnd(run: Run): Run {
    return run;
  }
}

export class StringRedactor extends Redactor {
  declare TargetType: string | RegExp;
  constructor(opts: PartialRequired<RedactorOpts<StringRedactor["TargetType"]>, "replaceTargets">) {
    super(opts);
  }
  redactInput(run: Run): Run {
    if (
      (this.chainTargets &&
        this.chainTargets.length > 0 &&
        !this.chainTargets.includes(run.run_type as RedactorChainTypes)) ||
      !this.replaceTargets ||
      this.replaceTargets.length === 0 ||
      (this?.lc_name && run.name !== this.lc_name)
    ) {
      return run;
    }

    return this.replaceTargets.reduce((acc, target) => {
      return this.redactInputString(acc, target);
    }, run);
  }

  redactOutput(run: Run): Run {
    if (
      (this.chainTargets &&
        this.chainTargets.length > 0 &&
        !this.chainTargets.includes(run.run_type as RedactorChainTypes)) ||
      !this.replaceTargets ||
      this.replaceTargets.length === 0 ||
      (this?.lc_name && run.name !== this.lc_name)
    ) {
      return run;
    }

    return this.replaceTargets.reduce((acc, target) => {
      return this.redactOutputString(acc, target);
    }, run);
  }

  redactInputString(run: Run, target: string | RegExp) {
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
    const clonedRun = cloneDeep(run);

    if (run.run_type === "llm") {
      if ("prompts" in clonedRun.inputs) {
        const prompts = clonedRun.inputs.prompts as string[];
        clonedRun.inputs.prompts = prompts.map((prompt) => {
          const replaceWith = this.replaceWith();
          redactions.ids.push(run.id);
          redactions.keys.push("prompts");
          redactions.targets.push(clonedRun.inputs["prompts"]);
          redactions.replacements.push(replaceWith);
          if (typeof target === "string") {
            return prompt.replaceAll(target, replaceWith);
          } else if (target instanceof RegExp) {
            return prompt.replace(target, replaceWith);
          }
          return prompt;
        });
      } else if ("messages" in clonedRun.inputs) {
        const messages = clonedRun.inputs.messages as BaseMessage[][];
        messages.forEach((v, k) => {
          v.forEach((_, ik) => {
            const replaceWith = this.replaceWith();
            redactions.ids.push(run.id);
            redactions.keys.push(`clonedRun.inputs.messages[${k}][${ik}]`);
            redactions.targets.push(clonedRun.inputs.messages[k][ik].content);
            redactions.replacements.push(replaceWith);
            if (typeof target === "string") {
              clonedRun.inputs.messages[k][ik].content =
                clonedRun.inputs.messages[k][ik].content.replaceAll(
                  target,
                  replaceWith,
                );
            } else if (target instanceof RegExp) {
              clonedRun.inputs.messages[k][ik].content =
                clonedRun.inputs.messages[k][ik].content.replace(
                  target,
                  replaceWith,
                );
            }
          });
        });
      }
    } else {
      const replacements = this.redactEntries(
        run.id,
        clonedRun.inputs!,
        redactions,
      );
      clonedRun.inputs = { ...clonedRun.inputs, ...replacements };
    }

    this.callbacks?.onRedaction(
      redactions.ids,
      redactions.keys,
      redactions.targets,
      redactions.replacements,
    );
    return clonedRun;
  }

  redactOutputString(run: Run, target: string | RegExp) {
    if (
      !run.outputs ||
      !this.replaceTargets ||
      this.replaceTargets.length === 0 ||
      (this?.lc_name && run.name !== this.lc_name)
    ) {
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
    const clonedRun = cloneDeep(run);

    if (run.run_type === "llm") {
      if ("generations" in run.outputs) {
        run.outputs.generations.forEach(
          (generation: Generation[], k: number) => {
            generation.forEach((_, ik) => {
              const replaceWith = this.replaceWith();
              redactions.ids.push(run.id);
              redactions.keys.push(
                `clonedRun.outputs.generations[${k}][${ik}]`,
              );
              const source = clonedRun.outputs!.generations[k][ik];
              redactions.targets.push(source.text);
              redactions.replacements.push(replaceWith);
              if (typeof target === "string") {
                source.text = source.text.replaceAll(target, replaceWith);
                if (
                  source?.message?.additional_kwargs?.function_call?.arguments
                ) {
                  source.message.additional_kwargs.function_call.arguments =
                    source.message.additional_kwargs.function_call.arguments.replaceAll(
                      target,
                      replaceWith,
                    );
                }
              } else if (target instanceof RegExp) {
                source.text = source.text.replace(target, replaceWith);
                if (
                  source?.message?.additional_kwargs?.function_call?.arguments
                ) {
                  source.message.additional_kwargs.function_call.arguments =
                    source.message.additional_kwargs.function_call.arguments.replace(
                      target,
                      replaceWith,
                    );
                }
              }
            });
          },
        );
      }
    } else {
      const replacements = this.redactEntries(
        run.id,
        clonedRun.outputs!,
        redactions,
      );
      clonedRun.outputs = { ...clonedRun.outputs, ...replacements };
    }

    this.callbacks?.onRedaction(
      redactions.ids,
      redactions.keys,
      redactions.targets,
      redactions.replacements,
    );
    return clonedRun;
  }

  redactEntries(
    id: string,
    source: KVMap,
    redactions: {
      ids: string[];
      keys: string[];
      targets: string[];
      replacements: string[];
    },
  ) {
    const redactHelper = (kvMap: KVMap, path: string) => {
      Object.keys(kvMap).forEach((key) => {
        const newPath = path ? `${path}.${key}` : key;
        if (typeof kvMap[key] === "string") {
          const replaceWith = this.replaceWith();
          redactions.ids.push(id);
          redactions.keys.push(newPath);
          redactions.targets.push(kvMap[key]);
          redactions.replacements.push(replaceWith);
          kvMap[key] = this.replaceTargets?.reduce((acc, target) => {
            if (typeof target === "string") {
              return kvMap[key].replaceAll(target, replaceWith);
            } else if (target instanceof RegExp) {
              return kvMap[key].replace(target, replaceWith);
            }
            return acc;
          }, kvMap[key]);
        } else if (typeof kvMap[key] === "object") {
          redactHelper(kvMap[key], newPath);
        }
      });
    };
    redactHelper(source, "");
    return source;
  }

  onStart(run: Run): Run {
    return run;
  }

  onEnd(run: Run): Run {
    return run;
  }
}

export class RedactableLangChainTracer extends LangChainTracer {
  redactors: Redactor[];

  constructor(
    redactors: Redactor[],
    fields: LangChainTracerFields = {},
    {
      replaceWith,
      callbacks,
    }: {
      replaceWith?: string | (() => string);
      callbacks?: RedactorCallbacks;
    } = {},
  ) {
    super(fields);
    this.redactors = redactors;

    this.redactors.forEach((redactor) => {
      if (callbacks) {
        redactor.setCallbacks(callbacks);
      }
      if (replaceWith) {
        redactor.setReplaceWith(replaceWith);
      }
    });
    this.client = new Client({
      apiUrl: process.env.REDACTABLE_LANGCHAIN_ENDPOINT,
      apiKey: process.env.REDACTABLE_LANGCHAIN_API_KEY,
    }) as any;
  }

  async onRetrieverStart(run: Run): Promise<void> {
    let procRun = this.redactors.reduce(
      (acc, redactor) => redactor.onStart(acc),
      run,
    );
    procRun = this.runInputRedactors(procRun);
    await super.onRetrieverStart(procRun);
  }

  async onRetrieverEnd(run: Run): Promise<void> {
    let procRun = this.runInputRedactors(run);
    procRun = this.runOutputRedactors(procRun);
    await super.onRetrieverEnd(procRun);
    this.redactors.forEach((redactor) => redactor.onEnd(run));
  }

  async onLLMStart(run: Run): Promise<void> {
    let procRun = this.redactors.reduce(
      (acc, redactor) => redactor.onStart(acc),
      run,
    );
    procRun = this.runInputRedactors(procRun);
    await super.onLLMStart(procRun);
  }

  async onLLMEnd(run: Run): Promise<void> {
    let procRun = this.runInputRedactors(run);
    procRun = this.runOutputRedactors(procRun);
    await super.onLLMEnd(procRun);
    this.redactors.forEach((redactor) => redactor.onEnd(run));
  }

  async onChainStart(run: Run): Promise<void> {
    let procRun = this.redactors.reduce(
      (acc, redactor) => redactor.onStart(acc),
      run,
    );
    procRun = this.runInputRedactors(procRun);
    await super.onChainStart(procRun);
  }

  async onChainEnd(run: Run): Promise<void> {
    let procRun = this.runInputRedactors(run);
    procRun = this.runOutputRedactors(procRun);
    await super.onChainEnd(procRun);
    this.redactors.forEach((redactor) => redactor.onEnd(run));
  }

  async onToolStart(run: Run): Promise<void> {
    let procRun = this.redactors.reduce(
      (acc, redactor) => redactor.onStart(acc),
      run,
    );
    procRun = this.runInputRedactors(procRun);
    await super.onToolStart(procRun);
  }

  async onToolEnd(run: Run): Promise<void> {
    let procRun = this.runInputRedactors(run);
    procRun = this.runOutputRedactors(procRun);
    await super.onToolEnd(procRun);
    this.redactors.forEach((redactor) => redactor.onEnd(run));
  }

  runInputRedactors(run: Run) {
    if (this.redactors && this.redactors.length > 0) {
      return this.redactors.reduce(
        (acc, redactor) => redactor.redactInput(acc),
        run,
      );
    } else {
      return run;
    }
  }

  runOutputRedactors(run: Run) {
    if (this.redactors && this.redactors.length > 0) {
      return this.redactors.reduce(
        (acc, redactor) => redactor.redactOutput(acc),
        run,
      );
    } else {
      return run;
    }
  }
}
