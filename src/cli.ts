#!/usr/bin/env node

import optimist from "optimist";
import * as Path from "path";

import { config } from "./lib/config";
import { ErrorHandling } from "./lib/transforms";

import { cleanFiles, transformFiles, TransformFilesOptions } from "./index";

const argv = optimist
	.usage(
		`$0 filePattern...
If invoked as giismudge it will replace the included ignore directives in each file that matches each pattern.  Useful for updaiting your files!
If invoked as giiclean it will strip the included ignore directives out of each file that matches each pattern.

If you are looking to process text through a pipe, see giismudgepipe and giicleanpipe.

`
	)
	.options({
		errorHandling: {
			default: ErrorHandling.embedAsComments,
			describe:
				"Either 'embedAsComments', the default, to cause the error to save into the file or 'throwImmediate' to force the program to stop on the first error.",
			type: "string",
		},
	}).argv;

if (argv._.length <= 0) {
	console.error("Missing arguments!");
	process.exit(1);
}

(async (): Promise<void> => {
	const opts: TransformFilesOptions = {
		cwd: process.cwd(),
		files: (argv._ as string[]).filter((value) => value !== "$0"),
		errorHandling:
			argv.errorHandling === ErrorHandling.throwImmediate
				? ErrorHandling.throwImmediate
				: ErrorHandling.embedAsComments,
	};

	const basename = Path.basename(argv["$0"]);

	console.log("gitignore-include", config.npmConfig?.version ?? "");

	if (basename === "giismudge") {
		await transformFiles(opts);
	} else if (basename === "giismudge") {
		await cleanFiles(opts);
	} else {
		throw new Error("Unknown command name!");
	}
})().catch((err) => {
	console.error(err);
	process.exit(1);
});
