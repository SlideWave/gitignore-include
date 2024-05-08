#!/usr/bin/env node

import { createReadStream, createWriteStream } from "node:fs";
import * as Path from "node:path";

import * as FG from "fast-glob";
import Minimist from "minimist";

import { config } from "./config";
import {
	ErrorHandling,
	IncludesFilterClean,
	IncludesFilterSmudge,
	IncludesFilterSmudgeOptions,
} from "./lib/transforms";

//* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
export interface TransformFilesOptions extends IncludesFilterSmudgeOptions {
	/** Base path for the patterns defined in the files. */
	cwd: string;
	/** The files that should be converted. File and path globs are supported. */
	files: string[];
}

const argv = Minimist(process.argv.splice(2));

const opts: TransformFilesOptions = {
	cwd: process.cwd(),
	files: (argv._ as string[]).filter((value) => value !== "$0"),
	errorHandling:
		argv.errorHandling === ErrorHandling.throwImmediate
			? ErrorHandling.throwImmediate
			: ErrorHandling.embedAsComments,
};

/*
process.stdin.isTTY is true when the process is being run in an environment with a TTY and there's no data being piped in.

process.stdin.isTTY is falsy when:
1. The stdin is being routed from a pipe.
2. The process is being run in an environment without a TTY.

Thus process.stdin.isTTY is not a good indicator of whether or not there's input on stdin. It only can be use to prove that there's a TTY or not.
*/

if (opts.files.length <= 0) {
	process.stderr.write(`Missing file patterns!
[giismudge|giiclean] [errorHandling=embedAsComments|throwImmediate] [filePattern...]
If invoked as giismudge it will replace the included ignore directives in each file that matches each pattern. Useful for updating your files!
If invoked as giiclean it will strip the included ignore directives out of each file that matches each pattern.

If you are looking to process text through a pipe, simply pipe the data in and pass "-" as the file pattern. The output will be put on stdout.

Options
    errorHandling: Either 'embedAsComments', the default, to cause errors
                   to save into the file or 'throwImmediate' to force the
                   program to stop on the first error.
`);
	process.exit(1);
}

(async (): Promise<void> => {
	const filter =
		Path.basename(process.argv[1]) === "giismudge"
			? new IncludesFilterSmudge(opts)
			: new IncludesFilterClean(opts);

	if (opts.files.includes("-")) {
		// Pipe filter mode.
		await new Promise<void>((resolve, reject) => {
			filter.on("end", () => {
				resolve();
			});

			filter.on("error", (error) => {
				reject(error);
			});

			filter.pipe(process.stdout);
			try {
				process.stdin.pipe(filter);
			} finally {
				process.stdin.resume();
			}
		});
	} else {
		// File processor mode.
		process.stderr.write(
			`gitignore-include ${config.npmConfig?.version ?? "version unknown!?"}\n`
		);

		for await (let file of FG.stream(opts.files, {
			cwd: opts.cwd,
			dot: true,
		})) {
			if (file instanceof Buffer) {
				file = file.toString("utf8");
			}

			const filePath = Path.resolve(opts.cwd, file);

			const fileSource = createReadStream(filePath, { encoding: "utf8" });

			const filterResults = await new Promise<(string | Buffer)[]>(
				(resolve, reject) => {
					// Load the filtered results into memory so that we don't destroy the source file if something fails.
					const result: (string | Buffer)[] = [];

					filter.on("data", (data) => {
						if (typeof data === "string" || Buffer.isBuffer(data)) {
							result.push(data);
						}
					});

					filter.on("end", () => {
						resolve(result);
					});

					filter.on("error", (error) => {
						reject(error);
					});

					fileSource.on("end", () => {
						filter.end();
					});

					fileSource.pipe(filter);
				}
			);

			// Only write back to the file if we have something to write.
			if (filterResults.length) {
				const fileSink = createWriteStream(filePath, { encoding: "utf8" });
				fileSink.write(filterResults.join(""));
				fileSink.end();
			}
		}
	}
})().catch((error) => {
	if (error instanceof Error) {
		process.stderr.write(`${error.stack ?? error.message}\n`);
	} else {
		process.stderr.write(
			`${
				typeof error === "object"
					? JSON.stringify(error, null, "  ")
					: String(error)
			}\n`
		);
	}
	process.exit(1);
});
