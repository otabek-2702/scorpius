import { getModel } from "../lib/ai";

/** Verifies the Gemini adapter: send a prompt, get text back. */
async function main() {
  const reply = await getModel().ask("Reply with exactly the word: OK");
  console.log("Gemini OK — reply:", JSON.stringify(reply.trim()));
}

main().catch((err) => {
  console.error("Gemini FAILED:", err);
  process.exit(1);
});
