// src/core/constants/shared-patterns.ts
export const ID_PATTERNS = {
    STATE: "^POS-[A-Z0-9-]+$",
    SEQUENCE: "^SEQ-[A-Z0-9-]{4,}",
    COMPONENT: "^CMP-[A-Z0-9-]+$",
    FAILURE_MODE: "^FM-[A-Z0-9-]+$"
} as const;