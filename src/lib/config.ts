/* eslint-disable no-process-env */

interface ConfigOptions {
	nodeEnv: string;
}

class Config {
	readonly nodeEnv: string;
	readonly npmConfig?: {
		name: string;
		version?: string;
	};

	get isProduction(): boolean {
		return this.nodeEnv === "production";
	}

	constructor(options: ConfigOptions) {
		this.nodeEnv = options.nodeEnv;

		if (process.env.npm_package_name) {
			this.npmConfig = {
				name: process.env.npm_package_name,
				version: process.env.npm_package_version,
			};
		}
	}
}

export const config = new Config({
	nodeEnv: process.env.NODE_ENV || "development",
});
