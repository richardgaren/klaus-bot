import express from 'express';
import { askKlaus, searchWeb } from './klaus-core.js';

const app = express();
app.use(express.json());
app.use(express.static('.'));

// Simple HTML frontend
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Klaus Test Interface</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        #chat { border: 1px solid #ccc; height: 400px; overflow-y: scroll; padding: 10px; margin: 20px 0; }
        .user { background: #e3f2fd; padding: 8px; margin: 5px 0; border-radius: 5px; }
        .klaus { background: #f3e5f5; padding: 8px; margin: 5px 0; border-radius: 5px; }
        #input { width: 70%; padding: 10px; }
        #send { padding: 10px 20px; }
    </style>
</head>
<body>
    <h1>Klaus Test Interface 🇩🇪</h1>
    <div id="chat"></div>
    <input type="text" id="input" placeholder="Type your message in German..." onkeypress="if(event.key==='Enter') sendMessage()">
    <button id="send" onclick="sendMessage()">Send</button>
    
    <script>
        const chat = document.getElementById('chat');
        const input = document.getElementById('input');
        
        function addMessage(content, isUser) {
            const div = document.createElement('div');
            div.className = isUser ? 'user' : 'klaus';
            div.innerHTML = content.replace(/\\n/g, '<br>');
            chat.appendChild(div);
            chat.scrollTop = chat.scrollHeight;
        }
        
        async function sendMessage() {
            const message = input.value.trim();
            if (!message) return;
            
            addMessage(message, true);
            input.value = '';
            
            try {
                const response = await fetch('/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message })
                });
                
                const data = await response.json();
                addMessage(data.reply, false);
            } catch (error) {
                addMessage('Error: ' + error.message, false);
            }
        }
        
        // Focus input on load
        input.focus();
    </script>
</body>
</html>
  `);
});

// Chat endpoint
app.post('/chat', async (req, res) => {
  const { message } = req.body;
  const testUserId = 'web-test-user';
  
  try {
    // Check for search context
    let context = "";
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes("wetter") || lowerMessage.includes("weather") || 
        lowerMessage.includes("nachrichten") || lowerMessage.includes("news") ||
        lowerMessage.includes("heute") || lowerMessage.includes("today")) {
      context = await searchWeb(message);
    }
    
    const reply = await askKlaus(testUserId, message, context);
    res.json({ reply });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.listen(3000, () => {
  console.log('Klaus web test interface running at http://localhost:3000');
});
