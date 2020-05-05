import * as ChildProcess from "child_process";
import { createReadStream, createWriteStream } from "fs";
import * as FG from "fast-glob";
import * as Path from "path";
import { promisify } from "util";

import {
	IncludesFilterSmudge,
	IncludesFilterSmudgeOptions,
	IncludesFilter,
	IncludesFilterClean,
} from "./lib/transforms";

const exec = promisify(ChildProcess.exec);

//* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
export interface TransformFilesOptions extends IncludesFilterSmudgeOptions {
	/** Base path for the patterns defined in the files. */
	cwd: string;
	/** The files that should be converted. File and path globs are supported. */
	files: string[];
}

//* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
interface TypeWithArgs<T, A extends unknown[]> extends Function {
	new (...args: A): T;
}

//= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
async function transform(
	options: TransformFilesOptions,
	transformer: TypeWithArgs<IncludesFilter, IncludesFilterSmudgeOptions[]>
): Promise<void> {
	for await (let file of FG.stream(options.files, {
		cwd: options.cwd,
		dot: true,
	})) {
		if (file instanceof Buffer) {
			file = file.toString("utf8");
		}

		const filePath = Path.resolve(options.cwd, file);

		const fileSource = createReadStream(filePath, { encoding: "utf8" });

		const filterResults = await new Promise<string[]>((resolve, reject) => {
			const filter = new transformer(options);

			const result: string[] = [];

			filter.on("data", (data) => {
				result.push(data.toString());
			});

			filter.on("end", () => {
				resolve(result);
			});

			filter.on("error", () => {
				reject();
			});

			fileSource.on("end", () => {
				filter.end();
			});

			fileSource.pipe(filter);
		});

		if (filterResults.length) {
			const fileSink = createWriteStream(filePath, { encoding: "utf8" });
			fileSink.write(filterResults.join(""));
			fileSink.end();
		}
	}
}

//= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
export const cleanFiles = (options: TransformFilesOptions): Promise<void> =>
	transform(options, IncludesFilterClean);

//* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
/**
 * @deprecated Don't use this or the smudge / clean filters: they don't play nicely.  Instead rely only on the NPM postinstall or prepare operations.
 */
export async function installGitHooks(): Promise<void> {
	await exec(
		`git config filter.ignoreProcessor.clean 'npx -q cross-env NODE_NO_WARNINGS=1 npx -q ts-node --project tsconfig.production.json util/ignoreClean.ts'`
	);

	await exec(
		`git config filter.ignoreProcessor.smudge 'npx -q cross-env NODE_NO_WARNINGS=1 npx -q ts-node --project tsconfig.production.json util/ignoreSmudge.ts'`
	);

	await exec(`git config filter.ignoreProcessor.required true`);
}

//* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
export const transformFiles = (options: TransformFilesOptions): Promise<void> =>
	transform(options, IncludesFilterSmudge);
