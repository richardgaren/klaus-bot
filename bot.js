import { askKlaus, searchWeb } from './klaus-core.js';
import { Bot } from "grammy";

const bot = new Bot(process.env.TELEGRAM_TOKEN);

bot.on("message:text", async (ctx) => {

  // Validate message length
  if (ctx.message.text.length > 1000) {
    await ctx.reply("Nachricht zu lang. (Message too long.)");
    return;
  }

  try {
    await ctx.replyWithChatAction("typing");  // show typing indicator

    const userId = ctx.from.id.toString();
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
    
    const response = await askKlaus(userId, ctx.message.text, context);
    await ctx.reply(response);

  } catch (error) {
    await ctx.reply("Entschuldigung, ich habe ein Problem. (Sorry, I have a problem.)");
    console.log("Error:", error);
  }
});

bot.start();

  console.log("Klaus is running! 🇩🇪");

// Heartbeat: Log every 60 minutes to indicate the bot is alive
setInterval(() => {
  console.log("Heartbeat: Klaus bot is alive");
}, 60 * 60 * 1000);