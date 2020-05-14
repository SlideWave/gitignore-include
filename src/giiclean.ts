#!/usr/bin/env node

import { opts } from "./cli";
import { cleanFiles } from "./index";

(async (): Promise<void> => {
	await cleanFiles(opts);
})().catch((err) => {
	console.error(err);
	process.exit(1);
});
