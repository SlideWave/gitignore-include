import { Transform, TransformCallback } from "stream";

import { https } from "follow-redirects";

const includePattern =
	/(?:##\s+<include\s+href="([^"]+)">.*?##\s+<\/include>\s*)|([^\n]*\n?)/gs;

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
// Utility functions
//= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
const gets = async (url: string): Promise<string> =>
	new Promise((resolve, reject) => {
		https
			.get(url, (response) => {
				let body = "";
				response.on("data", (chunk) => (body += chunk));
				response.on("end", () => resolve(body));
			})
			.on("error", reject);
	});

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

	_transform(
		chunk: Buffer | string,
		_encoding: string,
		callback: TransformCallback
	): void {
		if (chunk instanceof Buffer) {
			chunk = chunk.toString("utf8");
		}

		const matches = chunk.matchAll(includePattern);
		if (matches) {
			const result: string[] = [];
			for (const groups of matches) {
				if (groups[0].match(/^##\s+<include\s+/)) {
					result.push(`## <include href="${groups[1]}">`);
					result.push(`## </include>\n`);
				} else {
					result.push(groups[0].trim());
				}
			}
			this.push(result.join("\n"), "utf8"); // Make sure to only push once. This allows us to assume the chunk is the whole stream.
		} else {
			this.push(chunk, "utf8");
		}

		callback();
	}
}

//* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
/** Transforms a stream replacing all the contents between the include tags with updated content from the given URL. Fetch errors are by default embedded in the steam as comments. */
export class IncludesFilterSmudge extends IncludesFilter {
	constructor(options?: IncludesFilterSmudgeOptions) {
		super(options);
	}

	_transform(
		chunk: Buffer | string,
		_encoding: string,
		callback: TransformCallback
	): void {
		if (chunk instanceof Buffer) {
			chunk = chunk.toString("utf8");
		}

		(async (): Promise<void> => {
			const matches = chunk.matchAll(includePattern);
			if (matches) {
				const result: string[] = [];
				for (const groups of matches) {
					if (groups[0].match(/^##\s+<include\s+/)) {
						try {
							result.push(`## <include href="${groups[1]}">`);
							result.push(await gets(groups[1]));
							result.push(`## </include>\n`);
						} catch (e) {
							if (this._errorHandling === ErrorHandling.embedAsComments) {
								result.push(
									// Add a comment with the error.
									`# Error fetching source: ${e}`
										.replace(/\r\n|\r/g, "\n")
										.split("\n")
										.join("\n# ")
								);
								result.push(groups[0].trim()); // Make sure that a replace is nearly a no-op other than the error.
							} else {
								throw e;
							}
						}
					} else {
						result.push(groups[0].trim());
					}
				}
				this.push(result.join("\n"), "utf8"); // Make sure to only push once. This allows us to assume the chunk is the whole stream.
			} else {
				this.push(chunk, "utf8");
			}
		})()
			.then(() => {
				callback();
			})
			.catch((reason) => {
				if (reason instanceof Error) {
					process.stderr.write(reason.stack ?? reason.message);
				} else {
					process.stderr.write(
						typeof reason === "string" ? reason : JSON.stringify(reason)
					);
				}
			});
	}
}
