#!/usr/bin/env node
import { randomBytes } from "node:crypto";

const authSecret = randomBytes(32).toString("base64");
const encryptionKey = randomBytes(32).toString("base64");

console.log("Cole no seu .env:\n");
console.log(`AUTH_SECRET=${authSecret}`);
console.log(`APP_ENCRYPTION_KEY=${encryptionKey}`);
