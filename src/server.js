import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("✅ Discord bot is alive!");
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

export default app;
