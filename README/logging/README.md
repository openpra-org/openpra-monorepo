# Logging Best Practices and Usage Guide

## Overview

This document provides guidance on logging best practices for the OpenPRA monorepo and instructions on how to use the new custom logger implementation. Proper logging is essential for debugging, monitoring, and maintaining your application.

## Why Logging Matters

- **Debugging:** Helps trace issues and understand application flow.
- **Monitoring:** Enables tracking of system health and performance.
- **Auditing:** Records important events for compliance and analysis.

## General Logging Best Practices

1. **Use Contextual Loggers:** Always provide context (e.g., service/class name) when creating a logger instance.
2. **Log at Appropriate Levels:**
   - `log`/`info`: General information about application flow.
   - `warn`: Non-critical issues or unexpected states.
   - `error`: Exceptions or failures that need attention.
   - `debug`: Detailed information for development and debugging.
3. **Avoid Logging Sensitive Data:** Never log passwords, secrets, or personal information.
4. **Structure Log Messages:** Use clear, concise, and structured messages. Include relevant identifiers (IDs, user info, etc.) when possible.
5. **Log Exceptions with Stack Traces:** Always log the stack trace for errors to aid debugging.
6. **Do Not Over-Log:** Excessive logging can clutter logs and impact performance. Log only what is necessary.

## Using the Custom Logger

### 1. Global Logger Setup

**Note: This step is already done.**

The custom logger is set globally in `main.ts`:

```typescript
app.useLogger(LoggerFactory("web-backend"));
```

This ensures all global logs use the custom logger.

### 2. Per-Service Logging

```typescript
import { Logger } from "@nestjs/common";

export class MyService {
  private readonly logger = new Logger(MyService.name); // Uses built-in logger
}
```

### 3. Logging Examples

```typescript
this.logger.log("Service started");
this.logger.warn("Potential issue detected");
this.logger.error("Error occurred", error.stack);
```

## Summary

- Use the custom logger for consistent, configurable logging across the monorepo.
- Follow best practices for clarity, security, and performance.
- Refer to this guide when adding or updating logging in your code.

For more details, see the logger implementation in `/factory/logger.factory.ts` and the global setup in `main.ts`.
