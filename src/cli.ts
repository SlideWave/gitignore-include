import Minimist from "minimist";

import { config } from "./config";
import { ErrorHandling } from "./lib/transforms";

import { TransformFilesOptions } from ".";

const argv = Minimist(process.argv.splice(2));
if (argv._.length <= 0) {
	process.stderr.write(`Missing file patterns!
[giismudge|giiclean] [errorHandling=embedAsComments|throwImmediate] filePattern...
If invoked as giismudge it will replace the included ignore directives in each file that matches each pattern.  Useful for updating your files!
If invoked as giiclean it will strip the included ignore directives out of each file that matches each pattern.

Options
    errorHandling: Either 'embedAsComments', the default, to cause errors
                   to save into the file or 'throwImmediate' to force the
                   program to stop on the first error.
`);
	process.exit(1);
}

export const opts: TransformFilesOptions = {
	cwd: process.cwd(),
	files: (argv._ as string[]).filter((value) => value !== "$0"),
	errorHandling:
		argv.errorHandling === ErrorHandling.throwImmediate
			? ErrorHandling.throwImmediate
			: ErrorHandling.embedAsComments,
};

process.stderr.write(
	`gitignore-include ${config.npmConfig?.version ?? "version unknown!?"}\n`
);
