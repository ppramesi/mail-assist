import _ from "lodash";
import {
  Authorization,
} from "./base.js";
import Knex, { Knex as KnexT } from "knex";
import { PolicyContext, PolicyResult } from "../schema/index.js";

export class KnexAuthorization extends Authorization {
  private db: KnexT;
  constructor(configOrInstance: KnexT.Config | KnexT) {
    super();
    if (!_.isFunction(configOrInstance) && _.isObject(configOrInstance)) {
      this.db = Knex.knex(configOrInstance);
    } else {
      this.db = configOrInstance;
    }
  }

  async getUserPolicies(userId: string, _context: PolicyContext): Promise<PolicyResult> {
    return this.checkAdminWrapper(userId, async () => {
      return {
        createAllowed: true,
        readAllowed: true,
        updateAllowed: true,
        deleteAllowed: true,

        createAllAllowed: false, // maybe change later for admin
        readAllAllowed: false, // maybe change later for admin
        updateAllAllowed: false, // maybe change later for admin
        deleteAllAllowed: false, // maybe change later for admin
      }
    })
  }

  async getEmailPolicies(userId: string, context: PolicyContext): Promise<PolicyResult> {
    return this.checkAdminWrapper(userId, async () => {
      const defaultPolicy = KnexAuthorization.buildDefaultPolicy()
      const { params } = context
      defaultPolicy.createAllowed = true;
      if (params && params.id) {
        const exists = await this.db("emails")
          .where({ id: params.id, user_id: userId })
          .count("*")
          .then(count => Number(count[0]["count(*)"]) > 0)

        if (exists) {
          defaultPolicy.readAllowed = exists;
          defaultPolicy.updateAllowed = exists;
          defaultPolicy.deleteAllowed = exists
        }
      }
      return defaultPolicy
    })
  }

  async getContextPolicies(userId: string, context: PolicyContext): Promise<PolicyResult> {
    return this.checkAdminWrapper(userId, async () => {
      const defaultPolicy = KnexAuthorization.buildDefaultPolicy()
      const { params } = context
      defaultPolicy.createAllowed = true;
      if (params && params.id) {
        const exists = await this.db("context")
          .where({ id: params.id, user_id: userId })
          .count("*")
          .then(count => Number(count[0]["count(*)"]) > 0)

        if (exists) {
          defaultPolicy.readAllowed = exists;
          defaultPolicy.updateAllowed = exists;
          defaultPolicy.deleteAllowed = exists
        }
      }

      return defaultPolicy
    })
  }

  async getAllowedHostsPolicies(userId: string, context: PolicyContext): Promise<PolicyResult> {
    return this.checkAdminWrapper(userId, async () => {
      const defaultPolicy = KnexAuthorization.buildDefaultPolicy();
      const { params } = context;
      defaultPolicy.createAllowed = true;
      if (params && params.id) {
        const exists = await this.db("allowed_hosts")
          .where({ id: params.id, user_id: userId })
          .count("*")
          .then(count => Number(count[0]["count(*)"]) > 0)

        if (exists) {
          defaultPolicy.readAllowed = exists;
          defaultPolicy.updateAllowed = exists;
          defaultPolicy.deleteAllowed = exists
        }
      }

      return defaultPolicy
    });
  }

  async getReplyEmailPolicies(userId: string, context: PolicyContext): Promise<PolicyResult> {
    return this.checkAdminWrapper(userId, async () => {
      const defaultPolicy = KnexAuthorization.buildDefaultPolicy();
      const { params } = context;
      defaultPolicy.createAllowed = true;
      if (params) {
        if(params.id){
          const exists = await this.db("reply_emails")
            .where({ id: params.id, user_id: userId })
            .count("*")
            .then(count => Number(count[0]["count(*)"]) > 0)
  
          if (exists) {
            defaultPolicy.readAllowed = exists;
            defaultPolicy.updateAllowed = exists;
            defaultPolicy.deleteAllowed = exists
          }
        }else if(params.emailId){
          const exists = await this.db("reply_emails")
            .where({ email_id: params.emailId, user_id: userId })
            .count("*")
            .then(count => Number(count[0]["count(*)"]) > 0)
  
          if (exists) {
            defaultPolicy.readAllowed = exists;
            defaultPolicy.updateAllowed = exists;
            defaultPolicy.deleteAllowed = exists
          }
        }
      }

      return defaultPolicy
    });
  }

  async getChatHistoryPolicies(userId: string, context: PolicyContext): Promise<PolicyResult> {
    return this.checkAdminWrapper(userId, async () => {
      const defaultPolicy = KnexAuthorization.buildDefaultPolicy();
      defaultPolicy.createAllowed = true;
      const { params } = context
      if(params){
        if(params.id){
          const exists = await this.db("chat_history")
            .where({ id: params.id, user_id: userId })
            .count("*")
            .then(count => Number(count[0]["count(*)"]) > 0)
  
          if (exists) {
            defaultPolicy.readAllowed = exists;
            defaultPolicy.updateAllowed = exists;
            defaultPolicy.deleteAllowed = exists
          }
        }else if(params.emailId){
          const exists = await this.db("chat_history")
            .where({ email_id: params.emailId, user_id: userId })
            .count("*")
            .then(count => Number(count[0]["count(*)"]) > 0)
  
          if (exists) {
            defaultPolicy.readAllowed = exists;
            defaultPolicy.updateAllowed = exists;
            defaultPolicy.deleteAllowed = exists
          }
        }else if(params.replyId){
          const exists = await this.db("chat_history")
            .where({ reply_id: params.replyId, user_id: userId })
            .count("*")
            .then(count => Number(count[0]["count(*)"]) > 0)
  
          if (exists) {
            defaultPolicy.readAllowed = exists;
            defaultPolicy.updateAllowed = exists;
            defaultPolicy.deleteAllowed = exists
          }
        }
      }
      return defaultPolicy;
    });
  }

  async getEmbeddingsPolicies(userId: string): Promise<PolicyResult> {
    return this.checkAdminWrapper(userId, async () => {
      return KnexAuthorization.buildDefaultPolicy()
    })
  }

  private async checkAdminWrapper(userId: string, func: () => Promise<PolicyResult>): Promise<PolicyResult> {
    const isAdmin = await this.db("user_roles")
      .where({ user_id: userId, role: "admin" })
      .select("*")
      .then(v => v.length > 0)

    if (isAdmin) {
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
    } else {
      return func();
    }
  }
}