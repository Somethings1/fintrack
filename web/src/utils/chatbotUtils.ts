function extractJson(text: string): any {
    try {
        // Remove Markdown code fences if present
        const cleaned = text
            .replace(/```json|```/g, "")  // remove markdown fences
            .replace(/^\s*[\r\n]+|[\r\n]+\s*$/g, ""); // trim leading/trailing whitespace and newlines

        // Parse the cleaned JSON string
        return JSON.parse(cleaned);
    } catch (e) {
        console.error("Failed to parse AI response as JSON:", e, "Raw response:", text);
        return null;
    }
}

export const talkToGemini: any = async (input: string, accountNames: any, categoryNames: any) => {

    const prompt = `
You are a financial assistant.

You receive a sentence from the user and return a structured JSON object like this:

{
  transaction: {
    amount: number,
    type: "income" | "expense" | "transfer",
    sourceAccount?: string (ID),
    destinationAccount?: string (ID),
    category?: string (ID),
    note: string
  },
  error: null | {
    type: "account" | "category", // what is missing
    name: string, // The name of it
    message: string // Human readable message, indicating that you don't understand and kindly suggest creating one or edit to manually select from existing
  }
}

You MUST always return both "transaction" and "error". Accounts and categories are provided by pair of their ID and name.
You should find suitable account and category and put their IDs in JSON result.
Use only what is provided, don't make up new account or category.

Here are the accounts:
${JSON.stringify(accountNames)}

And here are the categories:
${JSON.stringify(categoryNames)}

Now, convert this sentence:
"${input}"
      `;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${import.meta.env.VITE_GEMINI_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
            }),
        }
    );

    const data = await response.json();
    const aiTextResponse = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const result = extractJson(aiTextResponse);

    if (!result || !result.transaction) {
        console.error("Invalid AI response format");
        return;
    }

    if (!result.transaction) {
        throw new Error("AI did not return a transaction");
    }

    return result;

}
