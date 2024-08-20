const express = require("express");
const bodyParser = require("body-parser");
const { Ollama } = require("ollama");

const app = express();
const port = 5001;

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

const ollama = new Ollama();

app.post("/ask", async (req, res) => {
  const { code } = req.body;
  try {
    const response = await ollama.chat({
      model: "llama3.1", // or any other model you prefer
      messages: [{ role: "user", content: code }],
      options: {
        temperature: 0.7,
        max_tokens: 2000,
      },
    });
    
    const reply = response.message.content;
    console.log(reply);
    
    res.json({ reply });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Error processing request" });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});