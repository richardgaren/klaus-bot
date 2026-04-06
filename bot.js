import { Bot } from "grammy";

const bot = new Bot(process.env.TELEGRAM_TOKEN);
const default_model = "llama3.1:8b";
const default_systemPrompt = "";

async function searchWeb(query) {
  try {
    // Use DuckDuckGo's instant answer API (no API key needed)
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
    const data = await response.json();
    return data.AbstractText || data.Answer || "Keine Informationen gefunden. (No information found.)";
  } catch (error) {
    return "Suchfehler. (Search error.)";
  }
}

async function askKlaus(message, context = "") {
  let systemPrompt = "Du bist Klaus, ein freundlicher deutscher Kollege aus der Tech-Branche in Zürich. Du antwortest immer zuerst auf Deutsch, dann in Klammern auf Englisch. Wenn ich Grammatikfehler mache, korrigiere sie sanft und erkläre warum. Konzentriere dich auf professionelles Deutsch für die Arbeit in der Schweiz und Deutschland. Erinnere dich an unsere Gespräche und baue darauf auf.";
  
  if (context) {
    systemPrompt += " Hier sind aktuelle Informationen: " + context;
  }

//  console.log("systemPrompt = " + systemPrompt);  // debug

  const response = await fetch("http://host.docker.internal:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: default_model,
      messages: [
        {role: "system", content: systemPrompt},
        {role: "user", content: message}
      ],
      stream: false,
      keep_alive: "4h" // keep model loaded for 4 hours
    })
  });
  
  const data = await response.json();
  return data.message.content;
}

bot.on("message:text", async (ctx) => {

  // Validate message length
  if (ctx.message.text.length > 1000) {
    await ctx.reply("Nachricht zu lang. (Message too long.)");
    return;
  }

  try {
    await ctx.replyWithChatAction("typing");  // show typing indicator

    const message = ctx.message.text.toLowerCase();
    let context = "";
    
    // Check if user is asking about weather or current events
    if (message.includes("wetter") || message.includes("weather") || 
        message.includes("nachrichten") || message.includes("news") ||
        message.includes("heute") || message.includes("today")) {
      
      // Extract search query
      const searchQuery = ctx.message.text;
      context = await searchWeb(searchQuery);
    }
    
    const response = await askKlaus(ctx.message.text, context);
    await ctx.reply(response);

  } catch (error) {
    await ctx.reply("Entschuldigung, ich habe ein Problem. (Sorry, I have a problem.)");
  }
});

bot.start();
console.log("Klaus is running! 🇩🇪");