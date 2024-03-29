import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import Path from "node:path";
import { Transform, TransformCallback } from "node:stream";

import { https } from "follow-redirects";

//* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
const includePattern =
	/(?:##\s*<include\s+(?<type>[^=]+)="(?<uri>[^"]+)">[\s\S]*?##\s*<\/include>[^\S\n]*)|(?:[^\n]+\n?)+|\n/g;
const tagPatternStart = /##\s*<include\s+/gs;
const tagPatternFinal = /##\s*<\/include>/gs;

//* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
export enum ErrorHandling {
	embedAsComments = "embedAsComments",
	throwImmediate = "throwImmediate",
}

//* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
export interface IncludesFilterSmudgeOptions {
	errorHandling?: ErrorHandling;
}

//* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
export type UriType = "file" | "href" | "module";

//= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
export class DuplicateIncludeError extends Error {
	constructor() {
		super("This is a duplicate of a previous include.");

		this.name = DuplicateIncludeError.name;
	}
}

//= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
export class InfiniteRecursionError extends Error {
	constructor() {
		super("Infinite recursion detected.");

		this.name = InfiniteRecursionError.name;
	}
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
export class WebError extends Error {
	constructor(code: number, meaning: string) {
		super(`${code} ${meaning}`);

		this.name = WebError.name;
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
				response.on("end", () => {
					if (
						response.statusCode !== undefined &&
						Math.floor(response.statusCode / 100) !== 2
					) {
						return reject(
							new WebError(response.statusCode, response.statusMessage ?? "")
						);
					}

					resolve(body);
				});
			})
			.on("error", reject);
	});
}

//= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
async function transform(
	fileContents: string,
	errorHandling: ErrorHandling,
	onIncludeData?: (
		includeType: UriType,
		includeUri: string
	) => Promise<string[] | string> | string[] | string,
	includesRecursed: Set<string> = new Set(),
	relativeTo: { type: UriType; uri: string } | undefined = undefined
): Promise<string> {
	if (onIncludeData) {
		// Clean out any import contents that already exist so that
		fileContents = await transform(fileContents, ErrorHandling.throwImmediate);
	}

	// Break recursive includes.
	const hashedChuck = createHash("sha256").update(fileContents).digest("hex");

	if (includesRecursed.has(hashedChuck)) {
		throw new InfiniteRecursionError();
	}
	includesRecursed.add(hashedChuck);

	const matches = fileContents.matchAll(includePattern);
	if (matches) {
		const result: string[] = [];
		for (const match of matches) {
			if (match.groups?.type && match.groups.uri) {
				result.push(
					`## <include ${match.groups.type}="${match.groups.uri}">\n`
				);
				try {
					if (
						onIncludeData &&
						(match.groups.type === "file" ||
							match.groups.type === "href" ||
							match.groups.type === "module")
					) {
						const uriMashup = `${match.groups.type}=${match.groups.uri}`;

						if (includesRecursed.has(uriMashup)) {
							throw new DuplicateIncludeError();
						}
						includesRecursed.add(uriMashup);

						// from  to    target result
						// none  file  file   Path.dirname(match.groups.uri) & match.groups.uri
						// none  href  href   Path.dirname(match.groups.uri) & match.groups.uri
						// none  mod   mod    Path.dirname(match.groups.uri) & match.groups.uri
						//
						// file  file  file   Path.dirname(relativeTo.uri + match.groups.uri) & Path.join(relativeTo.uri, match.groups.uri)
						// file  href  href   Path.dirname(relativeTo.uri + match.groups.uri) & match.groups.uri
						// file  mod   mod    Path.dirname(relativeTo.uri + match.groups.uri) & match.groups.uri
						//
						// href  file  href   Path.dirname(relativeTo.uri + match.groups.uri) & new URL(match.groups.uri, relativeTo.uri).href
						// href  href  href   Path.dirname(relativeTo.uri + match.groups.uri) & match.groups.uri
						// href  mod   mod    Path.dirname(relativeTo.uri + match.groups.uri) & match.groups.uri
						//
						// mod   file  mod    Unable to determine: a module of `@org/module`, `@org/module/path`, `module`, `module/path`, and './local/path/module.js' are valid, thus making the correct dirname difficult to determine.
						// mod   href  href   Path.dirname(relativeTo.uri + match.groups.uri) & match.groups.uri
						// mod   mod   mod    Path.dirname(relativeTo.uri + match.groups.uri) & match.groups.uri

						if (
							relativeTo &&
							relativeTo.type === "module" &&
							match.groups.type === "file"
						) {
							throw new InvalidModuleError(
								"Modules cannot include file URIs at this time. PRs are welcome."
							);
						}

						const path =
							match.groups.type === "href" || match.groups.type === "module"
								? match.groups.uri
								: relativeTo && relativeTo.type === "href"
								? // Called as an href is pulling a file ref, thus stays an href and is relative to the folder of the given path.
								  new URL(match.groups.uri, relativeTo.uri).href
								: // Called as a file is pulling a file ref, thus stays the original type and is relative to the folder of the given path.
								  Path.join(relativeTo?.uri ?? "", match.groups.uri);

						const contents = await onIncludeData(match.groups.type, path);

						const transformedContents = await transform(
							Array.isArray(contents) ? contents.join("\n") : contents,
							errorHandling,
							onIncludeData,
							includesRecursed,
							{
								type: relativeTo?.type ?? match.groups.type,
								uri: Path.dirname(path),
							}
						);
						result.push(
							transformedContents
								.replace(tagPatternStart, "## <embeddedinclude ")
								.replace(tagPatternFinal, "## </embeddedinclude>")
								.replace(/\n$/, "") + "\n"
						);
					} else if (onIncludeData) {
						throw new UnknownAttributeError(match.groups.type);
					}
				} catch (e) {
					if (errorHandling === ErrorHandling.embedAsComments) {
						// Add a comment with the error.
						result.push(
							`### Error fetching source: ${String(e).replace(
								/\r\n|\r|\n/g,
								"\n### "
							)}\n`
						);
					} else {
						throw e;
					}
				} finally {
					result.push(`## </include>`);
				}
			} else {
				result.push(match[0]);
			}
		}
		return result.join("");
	}

	return fileContents;
}

//= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
export class IncludesFilter extends Transform {
	protected _errorHandling: ErrorHandling;
	protected _fileContents: string;

	constructor(options?: IncludesFilterSmudgeOptions) {
		super();

		this._errorHandling =
			options?.errorHandling ?? ErrorHandling.embedAsComments;

		this._fileContents = "";
	}
}

//= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
/** Transforms a stream removing all the contents between the include tags. */
export class IncludesFilterClean extends IncludesFilter {
	constructor(options?: IncludesFilterSmudgeOptions) {
		super(options);
	}

	override _transform(
		chunk: Buffer | string,
		_encoding: string,
		callback: TransformCallback
	): void {
		if (chunk instanceof Buffer) {
			chunk = chunk.toString("utf8");
		}

		this._fileContents += chunk; // HACK: This is NOT how to do stream processing: loading it all into memory is a recipe for memory issues.
		callback();
	}

	override async _flush(callback: TransformCallback): Promise<void> {
		// Make sure to only push once. This allows us to assume the chunk is the whole stream.
		this.push(
			await transform(this._fileContents, ErrorHandling.throwImmediate),
			"utf8"
		);
		callback();
	}
}

//* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
/** Transforms a stream replacing all the contents between the include tags with updated content from the given URL. Fetch errors are by default embedded in the steam as comments. */
export class IncludesFilterSmudge extends IncludesFilter {
	constructor(options?: IncludesFilterSmudgeOptions) {
		super(options);
	}

	override _transform(
		chunk: Buffer | string,
		_encoding: string,
		callback: TransformCallback
	): void {
		if (chunk instanceof Buffer) {
			chunk = chunk.toString("utf8");
		}

		this._fileContents += chunk; // HACK: This is NOT how to do stream processing: loading it all into memory is a recipe for memory issues.
		callback();
	}

	override async _flush(callback: TransformCallback): Promise<void> {
		try {
			// Make sure to only push once. This allows us to assume the chunk is the whole stream.
			this.push(
				await transform(
					this._fileContents,
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
		} catch (error) {
			callback(
				error instanceof Error
					? error
					: new Error(
							typeof error === "object"
								? JSON.stringify(error, null, "  ")
								: String(error)
					  )
			);
			callback = (): void => {
				// Prevents a double call of the callback.
			};
		}
		callback(); // Has to be outside of the try so that the catch handler doesnt' have to worry about it.
	}
}
