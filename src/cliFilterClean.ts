#!/usr/bin/env node

import { IncludesFilterClean } from "./lib/transforms";

const fwd = new IncludesFilterClean();

fwd.pipe(process.stdout);

process.stdin.pipe(fwd);

process.stdin.resume();
