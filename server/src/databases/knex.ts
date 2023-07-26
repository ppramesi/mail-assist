import { Email } from "../adapters/base";
import { AIMessage, Context, Database, HumanMessage, PotentialReplyEmail, RawChatHistory } from "./base";


export class KnexDatabase extends Database {
    connect(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    disconnect(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    insertEmail(email: Email): Promise<void> {
        throw new Error("Method not implemented.");
    }
    insertEmails(emails: Email[]): Promise<void> {
        throw new Error("Method not implemented.");
    }
    getEmails(): Promise<Email[] | null> {
        throw new Error("Method not implemented.");
    }
    getEmail(id: string): Promise<Email | null> {
        throw new Error("Method not implemented.");
    }
    updateEmailProcessedData(id: string, status: string, summary?: string | undefined): Promise<void> {
        throw new Error("Method not implemented.");
    }
    insertContext(context: Context): Promise<void> {
        throw new Error("Method not implemented.");
    }
    getContext(): Promise<Context | null> {
        throw new Error("Method not implemented.");
    }
    getContextValue(key: string): Promise<string | null> {
        throw new Error("Method not implemented.");
    }
    getAllowedHosts(): Promise<string[] | null> {
        throw new Error("Method not implemented.");
    }
    setAllowedHosts(hosts: string[]): Promise<void> {
        throw new Error("Method not implemented.");
    }
    insertPotentialReply(data: PotentialReplyEmail): Promise<string> {
        throw new Error("Method not implemented.");
    }
    getPotentialReply(id: string): Promise<PotentialReplyEmail> {
        throw new Error("Method not implemented.");
    }
    insertChatHistory(chatHistory: RawChatHistory): Promise<string> {
        throw new Error("Method not implemented.");
    }
    appendChatHistory(id: string, messages: (AIMessage | HumanMessage)[]): Promise<void> {
        throw new Error("Method not implemented.");
    }
    getChatHistory(id: string): Promise<RawChatHistory> {
        throw new Error("Method not implemented.");
    }
    insertEmailChatHistory(chatHistory: RawChatHistory): Promise<string> {
        throw new Error("Method not implemented.");
    }
    getEmailChatHistory(replyId: string): Promise<RawChatHistory> {
        throw new Error("Method not implemented.");
    }
}