import express, { type Request, type Response } from "express";

/** Tiny HTTP endpoint so hosts like Render can health-check / keep the process alive. */
export function startKeepAlive(port: string): void {
  const app = express();

  app.get("/", (_req: Request, res: Response) => {
    res.send("✅ Discord bot is alive!");
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", uptime: Math.round(process.uptime()) });
  });

  app.listen(Number(port), () => {
    console.log(`🌐 Keep-alive server listening on port ${port}`);
  });
}
