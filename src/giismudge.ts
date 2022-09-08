#!/usr/bin/env node

import { opts } from "./cli";

import { transformFiles } from ".";

(async (): Promise<void> => {
	await transformFiles(opts);
})().catch((reason) => {
	if (reason instanceof Error) {
		process.stderr.write(reason.stack ?? reason.message);
	} else {
		process.stderr.write(
			typeof reason === "string" ? reason : JSON.stringify(reason)
		);
	}
	process.exit(1);
});
