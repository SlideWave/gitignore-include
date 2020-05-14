/* eslint-disable no-process-env */

import { readFileSync } from "fs";
import * as Path from "path";
import { JSONSchemaForNPMPackageJsonFiles } from "@schemastore/package";

interface ConfigOptions {
	nodeEnv: string;
}

class Config {
	readonly nodeEnv: string;
	readonly npmConfig?: JSONSchemaForNPMPackageJsonFiles;

	get isProduction(): boolean {
		return this.nodeEnv === "production";
	}

	constructor(options: ConfigOptions) {
		this.nodeEnv = options.nodeEnv;

		try {
			const packageJson = JSON.parse(
				readFileSync(Path.resolve(__dirname, "..", "package.json"), {
					encoding: "utf8",
				})
			);

			if (packageJson) {
				this.npmConfig = packageJson;
			}
		} catch {
			// Don't care.
		}
	}
}

export const config = new Config({
	nodeEnv: process.env.NODE_ENV || "development",
});
