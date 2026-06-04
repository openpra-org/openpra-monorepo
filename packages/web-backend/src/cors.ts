export const CorsConfig = {
  origin: "*",
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS", "HEAD"],
  allowedHeaders: [
    "Accept",
    "Accept-Encoding",
    "Authorization",
    "Content-Type",
    "DNT",
    "Origin",
    "User-Agent",
    "X-CSRFToken",
    "X-Requested-With",
  ],
  maxAge: 86400,
  preflightContinue: true,
  optionsSuccessStatus: 200,
};
