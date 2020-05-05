#!/usr/bin/env node

import { IncludesFilterSmudge } from "./lib/transforms";

const fwd = new IncludesFilterSmudge();

fwd.pipe(process.stdout);

process.stdin.pipe(fwd);

process.stdin.resume();
