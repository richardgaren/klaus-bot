import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

/** CONSTANTS */

const MODEL_SIMPLE = "llama3.1:8b"; // For standard, general conversations
const MODEL_COMPLEX = "qwen3.5:9b"; // For complex, detailed, or specialized topics (Using a placeholder model name)

const MEMORY_FILE = process.env.NODE_ENV === 'production' 
  ? "/app/data/klaus_conversations.json"  // Docker path
  : "./data/klaus_conversations.json";   // Local path for testing

const OLLAMA_URL = process.env.NODE_ENV === 'production' 
  ? "http://host.docker.internal:11434"  // Docker environment
  : "http://localhost:11434";             // Local environment

  /** FUNCTIONS */

// Ensure data directory exists
function ensureDataDir() {
  const dir = dirname(MEMORY_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// Load conversation memory
function loadMemory(userId) {
  ensureDataDir();
  if (!existsSync(MEMORY_FILE)) {
    return [];
  }
  try {
    const data = JSON.parse(readFileSync(MEMORY_FILE, "utf8"));
    return data[userId] || [];
  } catch (error) {
    console.log("Error loading memory:", error);
    return [];
  }
}

// Save conversation memory
function saveMemory(userId, messages) {
  ensureDataDir();
  let data = {};
  if (existsSync(MEMORY_FILE)) {
    try {
      data = JSON.parse(readFileSync(MEMORY_FILE, "utf8"));
    } catch (error) {
      console.log("Error reading existing memory:", error);
    }
  }
  
  // Keep last 10 exchanges (20 messages total: 10 user + 10 assistant)
  data[userId] = messages.slice(-20);
  writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
}

// Simple keyword-based model selection
function selectModel(message) {
  const grammarKeywords = ["korrigiere", "correct", "grammar", "grammatik", "fehler", "mistake", "falsch", "wrong"];
  const complexKeywords = ["erkläre", "explain", "warum", "why", "unterschied", "difference", "regel", "rule"];
  
  const lowerMessage = message.toLowerCase();
  const isGrammarTask = grammarKeywords.some(keyword => lowerMessage.includes(keyword));
  const isComplexTask = complexKeywords.some(keyword => lowerMessage.includes(keyword));
  
  if (isGrammarTask || isComplexTask) {
    return MODEL_COMPLEX; // Better German grammer and complex, detailed, or specialized topics
  }
  
  return MODEL_SIMPLE; // Better for standard, general conversations
}

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

async function analyzeGrammar(userId, userMessage) {
  const grammarSystemPrompt = `Du bist ein deutscher Grammatikexperte. Analysiere den folgenden deutschen Text auf Grammatikfehler.

Wenn du Fehler findest:
1. Zeige den korrigierten Satz
2. Erkläre jeden Fehler kurz und präzise
3. Gib den Grund für die Korrektur an

Wenn der Text korrekt ist, sage einfach "Grammatik ist korrekt!"

Format:
KORREKTUR: [korrigierter Satz]
FEHLER: [Erklärung der Fehler]

Analysiere nur die Grammatik, nicht den Inhalt.`;

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL_SIMPLE, // Use the smarter model for grammar analysis
      messages: [
        {role: "system", content: grammarSystemPrompt},
        {role: "user", content: userMessage}
      ],
      stream: false,
      keep_alive: "4h"
    })
  });
  
  const data = await response.json();
  return data.message.content;
}

async function askKlaus(userId, message, context = "") {
  // Load conversation history
  const history = loadMemory(userId);

  // Check if this is a German message that should be grammar-checked
  const isGermanMessage = /[äöüßÄÖÜ]/.test(message) || 
    ['ich', 'du', 'er', 'sie', 'wir', 'ihr', 'der', 'die', 'das', 'ein', 'eine'].some(word => 
      message.toLowerCase().includes(word)
    );

  let grammarFeedback = "";
  if (isGermanMessage && message.length > 10) {
    console.log("Analyzing grammar for:", message.substring(0, 50));
    const grammarAnalysis = await analyzeGrammar(userId, message);
    
    // Only include grammar feedback if errors were found
    if (!grammarAnalysis.includes("Grammatik ist korrekt")) {
      grammarFeedback = "\n\n📝 GRAMMATIK:\n" + grammarAnalysis;
    }
  }

  let systemPrompt = "Du bist Klaus, ein freundlicher deutscher Kollege aus der Tech-Branche in Zürich. Du antwortest immer zuerst auf Deutsch, dann in Klammern auf Englisch. Konzentriere dich auf professionelles Deutsch für die Arbeit in der Schweiz und Deutschland. Erinnere dich an unsere Gespräche und baue darauf auf.";
  
  if (context) {
    systemPrompt += " Hier sind aktuelle Informationen: " + context;
  }

  // Build messages array with history
  const messages = [
    {role: "system", content: systemPrompt},
    ...history, // Include conversation history
    {role: "user", content: message}
  ];

  console.log("systemPrompt = " + systemPrompt);  // debug

  const model = selectModel(message); // Select model based on message content
  console.log("Using model: " + model); // debug

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model,
      messages: messages,
      stream: false,
      keep_alive: "4h" // keep model loaded for 4 hours
    })
  });
  
  const data = await response.json();
  const reply = data.message.content;

  // Combine Klaus's response with grammar feedback
  const fullReply = reply + grammarFeedback;

  // Update conversation history
  history.push({role: "user", content: message});
  history.push({role: "assistant", content: reply});

  // Save the conversation
  saveMemory(userId, history);

  return fullReply;
}

export { askKlaus, searchWeb };