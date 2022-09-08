import { createReadStream, createWriteStream } from "fs";
import * as FG from "fast-glob";
import * as Path from "path";

import {
	IncludesFilterSmudge,
	IncludesFilterSmudgeOptions,
	IncludesFilter,
	IncludesFilterClean,
} from "./lib/transforms";

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
export const transformFiles = (options: TransformFilesOptions): Promise<void> =>
	transform(options, IncludesFilterSmudge);
