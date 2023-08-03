import { ChatOpenAI } from "langchain/chat_models/openai";
import { ConversationalEmailEvaluator } from "../user_evaluation.js";
import Knex from "knex";
import { KnexDatabase } from "../../databases/knex.js";

(async () => {
  const knex = Knex.knex({
    client: "postgresql",
    connection: {
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT!),
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
    },
  });
  
  const db = new KnexDatabase(knex);

  const llm = new ChatOpenAI();

  const evaluator = new ConversationalEmailEvaluator({
    llm,
    db,
  });

  const contextObj = {
    "User's full name": "Jim Testing Lorem",
    "User's email address": "jim_testing_lorem@test.com",
  };

  const body = `Dear Jim Testing,

I hope this email finds you well.

I wanted to inform you of a new software engineering task that needs your attention. It involves enhancing our existing API with a few new endpoints. These new endpoints are critical for our new feature launch that is coming up next month.

Here are the details of the endpoints that we need:

1. "/users": GET, POST, and DELETE methods for managing user data.
2. "/products": GET and POST methods for fetching and adding new products.
3. "/orders": GET, POST, and DELETE methods for order management.

We would like these to be completed by the end of next week, if possible.

Please let me know if you have any questions or if anything is unclear.

Thank you for your hard work!

Best,
John Person`;

  const _k1 = await evaluator.call({
    replyId: "test",
    context: Object.entries(contextObj)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n"),
    body,
    intention: "Clarify requirements",
    input: "Could you make it more detailed for me?",
  });

  const _k2 = await evaluator.call({
    context: Object.entries(contextObj)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n"),
    body,
    intention: "Clarify requirements",
    input:
      "Oh wait I'm Indonesian, could you translate it to Indonesian for me?",
  });

  const _k3 = await evaluator.call({
    context: Object.entries(contextObj)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n"),
    body,
    intention: "Clarify requirements",
    input: "Oh wait John Person is German, could you translate it for me?",
  });
  console.log({ _k1, _k2, _k3 });
  console.log(await db.getChatHistoryByEmail("test"));
})();
