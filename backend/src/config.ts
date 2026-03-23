export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 4000,
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  maxTurns: 8,
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o: string) => o.trim())
    : [
        "http://localhost:3000",
        "https://vantum0.vercel.app",
        /\.vercel\.app$/,
        /\.railway\.app$/,
      ],
};
