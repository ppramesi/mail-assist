import { PolicyContext, PolicyResult } from "../schema/index.js";

export abstract class Authorization {
  abstract getUserPolicies(
    userId: string,
    context: PolicyContext,
  ): Promise<PolicyResult>;

  abstract getEmailPolicies(
    userId: string,
    context: PolicyContext,
  ): Promise<PolicyResult>;

  abstract getContextPolicies(
    userId: string,
    context: PolicyContext,
  ): Promise<PolicyResult>;

  abstract getAllowedHostsPolicies(
    userId: string,
    context: PolicyContext,
  ): Promise<PolicyResult>;

  abstract getReplyEmailPolicies(
    userId: string,
    context: PolicyContext,
  ): Promise<PolicyResult>;

  abstract getChatHistoryPolicies(
    userId: string,
    context: PolicyContext,
  ): Promise<PolicyResult>;

  abstract getEmbeddingsPolicies(
    userId: string,
    context: PolicyContext,
  ): Promise<PolicyResult>;

  abstract getProcessEmailsPolicies(
    userId: string,
    context: PolicyContext,
  ): Promise<PolicyResult>;

  abstract getEvaluateEmailPolicies(
    userId: string,
    context: PolicyContext,
  ): Promise<PolicyResult>;

  static buildDefaultPolicy(): PolicyResult {
    return {
      createAllowed: false,
      readAllowed: false,
      updateAllowed: false,
      deleteAllowed: false,

      createAllAllowed: false,
      readAllAllowed: false,
      updateAllAllowed: false,
      deleteAllAllowed: false,
    };
  }
}
