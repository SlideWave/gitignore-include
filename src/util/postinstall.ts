import * as Path from "path";

import { config } from "../config";
import { transformFiles } from "../index";

if (config.isProduction) {
	process.exit(0);
}

(async (): Promise<void> => {
	const cwd = Path.resolve(__dirname, "..", "..");

	console.log("gitignore-include", config.npmConfig?.version ?? "");

	await transformFiles({
		cwd,
		files: [".*ignore"],
	});
})().catch((reason) => {
	console.error(reason);
	process.exit(1);
});
