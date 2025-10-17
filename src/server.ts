import express, { type Express, type Request, type Response } from "express";

const app: Express = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req: Request, res: Response) => {
  res.send("✅ Discord bot is alive!");
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

export default app;
