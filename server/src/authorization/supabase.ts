import _ from "lodash";
import { Authorization } from "./base.js";
import { PolicyContext, PolicyResult } from "../schema/index.js";

/**
 * For supabase, authorization SHOULD BE
 * HANDLED BY RLS!
 */

export class SupabaseAuthorization extends Authorization {
  async getUserPolicies(
    _userId: string,
    _context: PolicyContext,
  ): Promise<PolicyResult> {
    return {
      createAllowed: true,
      readAllowed: true,
      updateAllowed: true,
      deleteAllowed: true,

      createAllAllowed: true,
      readAllAllowed: true,
      updateAllAllowed: true,
      deleteAllAllowed: true,
    };
  }

  async getEmailPolicies(
    _userId: string,
    _context: PolicyContext,
  ): Promise<PolicyResult> {
    return {
      createAllowed: true,
      readAllowed: true,
      updateAllowed: true,
      deleteAllowed: true,

      createAllAllowed: true,
      readAllAllowed: true,
      updateAllAllowed: true,
      deleteAllAllowed: true,
    };
  }

  async getContextPolicies(
    _userId: string,
    _context: PolicyContext,
  ): Promise<PolicyResult> {
    return {
      createAllowed: true,
      readAllowed: true,
      updateAllowed: true,
      deleteAllowed: true,

      createAllAllowed: true,
      readAllAllowed: true,
      updateAllAllowed: true,
      deleteAllAllowed: true,
    };
  }

  async getAllowedHostsPolicies(
    _userId: string,
    _context: PolicyContext,
  ): Promise<PolicyResult> {
    return {
      createAllowed: true,
      readAllowed: true,
      updateAllowed: true,
      deleteAllowed: true,

      createAllAllowed: true,
      readAllAllowed: true,
      updateAllAllowed: true,
      deleteAllAllowed: true,
    };
  }

  async getReplyEmailPolicies(
    _userId: string,
    _context: PolicyContext,
  ): Promise<PolicyResult> {
    return {
      createAllowed: true,
      readAllowed: true,
      updateAllowed: true,
      deleteAllowed: true,

      createAllAllowed: true,
      readAllAllowed: true,
      updateAllAllowed: true,
      deleteAllAllowed: true,
    };
  }

  async getChatHistoryPolicies(
    _userId: string,
    _context: PolicyContext,
  ): Promise<PolicyResult> {
    return {
      createAllowed: true,
      readAllowed: true,
      updateAllowed: true,
      deleteAllowed: true,

      createAllAllowed: true,
      readAllAllowed: true,
      updateAllAllowed: true,
      deleteAllAllowed: true,
    };
  }

  async getEmbeddingsPolicies(
    _userId: string,
    _context: PolicyContext,
  ): Promise<PolicyResult> {
    return {
      createAllowed: true,
      readAllowed: true,
      updateAllowed: true,
      deleteAllowed: true,

      createAllAllowed: true,
      readAllAllowed: true,
      updateAllAllowed: true,
      deleteAllAllowed: true,
    };
  }

  async getProcessEmailsPolicies(
    _userId: string,
    _context: PolicyContext,
  ): Promise<PolicyResult> {
    return {
      createAllowed: true,
      readAllowed: true,
      updateAllowed: true,
      deleteAllowed: true,

      createAllAllowed: true,
      readAllAllowed: true,
      updateAllAllowed: true,
      deleteAllAllowed: true,
    };
  }

  async getEvaluateEmailPolicies(
    _userId: string,
    _context: PolicyContext,
  ): Promise<PolicyResult> {
    return {
      createAllowed: true,
      readAllowed: true,
      updateAllowed: true,
      deleteAllowed: true,

      createAllAllowed: true,
      readAllAllowed: true,
      updateAllAllowed: true,
      deleteAllAllowed: true,
    };
  }
}
