/**
 * Default CORS configuration for the backend HTTP server.
 * Allows common methods/headers and any origin; tune in production as needed.
 */
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
