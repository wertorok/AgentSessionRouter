#!/usr/bin/env node

import { createServer } from "./server.js";

await createServer().start();

