import { readFile } from "node:fs/promises";
import { Transform, TransformCallback } from "node:stream";

import { https } from "follow-redirects";

//* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
const includePattern =
	/(?:##\s*<include\s+(?<type>[^=]+)="(?<uri>[^"]+)">.*?##\s*<\/include>\s*)|([^\n]*\n?)/gs;

//* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
export enum ErrorHandling {
	embedAsComments = "embedAsComments",
	throwImmediate = "throwImmediate",
}

//* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
export interface IncludesFilterSmudgeOptions {
	errorHandling?: ErrorHandling;
}

//= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
export class InvalidModuleError extends Error {
	constructor(message: string) {
		super(message);

		this.name = InvalidModuleError.name;
	}
}

//= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
export class UnknownAttributeError extends Error {
	constructor(attribute: string) {
		super(`Unrecognized attribute '${attribute}'`);

		this.name = UnknownAttributeError.name;
	}
}

//= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
// Utility functions
//= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
async function getHref(url: string): Promise<string> {
	return new Promise((resolve, reject) => {
		https
			.get(url, (response) => {
				let body = "";
				response.on("data", (chunk) => (body += chunk));
				response.on("end", () => resolve(body));
			})
			.on("error", reject);
	});
}

//= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
async function transform(
	chunk: Buffer | string,
	errorHandling: ErrorHandling,
	onIncludeData?: (
		includeType: "file" | "href" | "module",
		includeUri: string
	) => Promise<string[] | string> | string[] | string
): Promise<string> {
	if (chunk instanceof Buffer) {
		chunk = chunk.toString("utf8");
	}

	const matches = chunk.matchAll(includePattern);
	if (matches) {
		const result: string[] = [];
		for (const match of matches) {
			if (match.groups?.type && match.groups?.uri) {
				result.push(`## <include ${match.groups.type}="${match.groups.uri}">`);
				try {
					if (
						match.groups.type === "file" ||
						match.groups.type === "href" ||
						match.groups.type === "module"
					) {
						if (onIncludeData) {
							const contents = await onIncludeData(
								match.groups.type,
								match.groups.uri
							);

							if (Array.isArray(contents)) {
								result.push(...contents);
							} else {
								result.push(contents);
							}
						}
					} else {
						throw new UnknownAttributeError(match.groups.type);
					}
				} catch (e) {
					if (errorHandling === ErrorHandling.embedAsComments) {
						// Add a comment with the error.
						result.push(
							`### Error fetching source: ${e}`.replace(/\r\n|\r|\n/g, "\n### ")
						);
					} else {
						throw e;
					}
				} finally {
					result.push(`## </include>\n`);
				}
			} else {
				result.push(match[0].trim());
			}
		}
		return result.join("\n");
	}

	return chunk;
}

//= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
export class IncludesFilter extends Transform {
	protected _errorHandling: ErrorHandling;

	constructor(options?: IncludesFilterSmudgeOptions) {
		super();

		this._errorHandling =
			options?.errorHandling ?? ErrorHandling.embedAsComments;
	}
}

//= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
/** Transforms a stream removing all the contents between the include tags. */
export class IncludesFilterClean extends IncludesFilter {
	constructor(options?: IncludesFilterSmudgeOptions) {
		super(options);
	}

	async _transform(
		chunk: Buffer | string,
		_encoding: string,
		callback: TransformCallback
	): Promise<void> {
		// Make sure to only push once. This allows us to assume the chunk is the whole stream.
		this.push(await transform(chunk, this._errorHandling), "utf8");
		callback();
	}
}

//* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
/** Transforms a stream replacing all the contents between the include tags with updated content from the given URL. Fetch errors are by default embedded in the steam as comments. */
export class IncludesFilterSmudge extends IncludesFilter {
	constructor(options?: IncludesFilterSmudgeOptions) {
		super(options);
	}

	async _transform(
		chunk: Buffer | string,
		_encoding: string,
		callback: TransformCallback
	): Promise<void> {
		try {
			// Make sure to only push once. This allows us to assume the chunk is the whole stream.
			this.push(
				await transform(
					chunk,
					this._errorHandling,
					async (includeType, includeUri) => {
						if (includeType === "file") {
							return await readFile(includeUri, "utf8");
						}

						if (includeType === "href") {
							return await getHref(includeUri);
						}

						const imported = await import(includeUri);

						if (typeof imported.default === "string") {
							return imported.default;
						} else {
							throw new InvalidModuleError(
								"Module is required to default export a string."
							);
						}
					}
				),
				"utf8"
			);
			callback();
		} catch (reason) {
			if (reason instanceof Error) {
				process.stderr.write(reason.stack ?? reason.message);
			} else {
				process.stderr.write(
					typeof reason === "string" ? reason : JSON.stringify(reason)
				);
			}
		}
	}
}
