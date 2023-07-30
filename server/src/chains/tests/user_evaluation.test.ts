import { ChatOpenAI } from "langchain/chat_models/openai";
import { InMemoryDatabase } from "../../databases/memory";
import { ConversationalEmailEvaluator } from "../user_evaluation";

(async () => {
  const db = new InMemoryDatabase();
  db.insertChatHistory({
    id: "test",
    email_id: "test",
    reply_id: "test",
    chat_messages: [
      {
        type: "ai",
        text: `Dear John,
    
Thanks for the detailed task. I have a few questions before I can start working on these endpoints.
  
1. For the "/users" endpoint, what fields should the POST method accept for creating a new user?
2. For the "/products" endpoint, are there any specific requirements for the data format?
3. Regarding the "/orders" endpoint, is there any particular flow that should be followed when creating or deleting an order?

I would also appreciate it if you could provide any existing API documentation or sample data that I could use for reference.
  
Thanks,
Jim Testing`,
      },
    ],
  });

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

  const k1 = await evaluator.call({
    replyId: "test",
    context: Object.entries(contextObj)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n"),
    body,
    intention: "Clarify requirements",
    input: "Could you make it more detailed for me?",
  });

  const k2 = await evaluator.call({
    context: Object.entries(contextObj)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n"),
    body,
    intention: "Clarify requirements",
    input:
      "Oh wait I'm Indonesian, could you translate it to Indonesian for me?",
  });

  const k3 = await evaluator.call({
    context: Object.entries(contextObj)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n"),
    body,
    intention: "Clarify requirements",
    input: "Oh wait John Person is German, could you translate it for me?",
  });

  console.log(await db.getChatHistoryByEmail("test"));
})();
