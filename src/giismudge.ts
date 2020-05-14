#!/usr/bin/env node

import { opts } from "./cli";
import { transformFiles } from "./index";

(async (): Promise<void> => {
	await transformFiles(opts);
})().catch((err) => {
	console.error(err);
	process.exit(1);
});
