import { exec as execCallback } from "node:child_process";
import FS from "node:fs/promises";
import * as Path from "node:path";
import * as Util from "node:util";

import { expect } from "chai";

const execAsync = Util.promisify(execCallback);

const TEST_DATA_PATH = "test/data";
const TEMP1_FILE_NAME = "temp1.ignore";
const TEMP2_FILE_NAME = "temp2.ignore";

const CLEANED_FILE_PATH = Path.join(TEST_DATA_PATH, "clean.ignore");
const SMUDGED_FILE_PATH = Path.join(TEST_DATA_PATH, "smudged.ignore");
const TEMP1_FILE_PATH = Path.join(TEST_DATA_PATH, TEMP1_FILE_NAME);
const TEMP2_FILE_PATH = Path.join(TEST_DATA_PATH, TEMP2_FILE_NAME);

// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
describe(__filename, () => {
	let cleanedFileData: string;
	let smudgedFileData: string;

	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	before(async function () {
		cleanedFileData = await FS.readFile(CLEANED_FILE_PATH, "utf8");
		smudgedFileData = await FS.readFile(SMUDGED_FILE_PATH, "utf8");

		await execAsync(
			"rm -f ~/.nvm/versions/node/*/bin/gii*; npm run build && npm link"
		);
	});

	// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	describe("Using piped data", () => {
		/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
		it("does nothing if the file is already cleaned", async function () {
			return expect(
				execAsync("giiclean - < clean.ignore", {
					cwd: "test/data",
				})
			).to.eventually.have.property("stdout", cleanedFileData);
		});

		/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
		it("cleans a smudged file", async function () {
			return expect(
				execAsync("giiclean - < smudged.ignore", {
					cwd: "test/data",
				})
			).to.eventually.have.property("stdout", cleanedFileData);
		});

		/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
		it("does nothing if the file is already smudged", async function () {
			return expect(
				execAsync("giismudge - < smudged.ignore", {
					cwd: "test/data",
				})
			).to.eventually.have.property("stdout", smudgedFileData);
		});

		/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
		it("smudges a clean file", async function () {
			return expect(
				execAsync("giismudge - < clean.ignore", {
					cwd: "test/data",
				})
			).to.eventually.have.property("stdout", smudgedFileData);
		});
	});

	// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
	/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
	describe("Using mutated files", () => {
		/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
		afterEach(async function () {
			await FS.rm(TEMP1_FILE_PATH, { force: true });
			await FS.rm(TEMP2_FILE_PATH, { force: true });
		});

		/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
		it("does nothing if the file is already cleaned", async function () {
			await FS.copyFile(CLEANED_FILE_PATH, TEMP1_FILE_PATH);

			await execAsync(`giiclean ${TEMP1_FILE_NAME}`, {
				cwd: "test/data",
			});

			return expect(FS.readFile(TEMP1_FILE_PATH, "utf8")).to.eventually.equal(
				cleanedFileData
			);
		});

		/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
		it("cleans a smudged file", async function () {
			await FS.copyFile(SMUDGED_FILE_PATH, TEMP1_FILE_PATH);

			await execAsync(`giiclean ${TEMP1_FILE_NAME}`, {
				cwd: "test/data",
			});

			return expect(FS.readFile(TEMP1_FILE_PATH, "utf8")).to.eventually.equal(
				cleanedFileData
			);
		});

		/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
		it("cleans the first of two smudged files", async function () {
			await FS.copyFile(SMUDGED_FILE_PATH, TEMP1_FILE_PATH);
			await FS.copyFile(SMUDGED_FILE_PATH, TEMP2_FILE_PATH);

			await execAsync(`giiclean ${TEMP1_FILE_NAME} ${TEMP2_FILE_NAME}`, {
				cwd: "test/data",
			});

			return expect(FS.readFile(TEMP1_FILE_PATH, "utf8")).to.eventually.equal(
				cleanedFileData
			);
		});

		/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
		it("cleans the second of two smudged files", async function () {
			await FS.copyFile(SMUDGED_FILE_PATH, TEMP1_FILE_PATH);
			await FS.copyFile(SMUDGED_FILE_PATH, TEMP2_FILE_PATH);

			await execAsync(`giiclean ${TEMP1_FILE_NAME} ${TEMP2_FILE_NAME}`, {
				cwd: "test/data",
			});

			return expect(FS.readFile(TEMP2_FILE_PATH, "utf8")).to.eventually.equal(
				cleanedFileData
			);
		});

		/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
		it("does nothing if the file is already smudged", async function () {
			await FS.copyFile(SMUDGED_FILE_PATH, TEMP1_FILE_PATH);

			await execAsync(`giismudge ${TEMP1_FILE_NAME}`, {
				cwd: "test/data",
			});

			return expect(FS.readFile(TEMP1_FILE_PATH, "utf8")).to.eventually.equal(
				smudgedFileData
			);
		});

		/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
		it("smudges a clean file", async function () {
			await FS.copyFile(CLEANED_FILE_PATH, TEMP1_FILE_PATH);

			await execAsync(`giismudge ${TEMP1_FILE_NAME}`, {
				cwd: "test/data",
			});

			return expect(FS.readFile(TEMP1_FILE_PATH, "utf8")).to.eventually.equal(
				smudgedFileData
			);
		});

		/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
		it("smudges the first of two clean files", async function () {
			await FS.copyFile(CLEANED_FILE_PATH, TEMP1_FILE_PATH);
			await FS.copyFile(CLEANED_FILE_PATH, TEMP2_FILE_PATH);

			await execAsync(`giismudge ${TEMP1_FILE_NAME} ${TEMP2_FILE_NAME}`, {
				cwd: "test/data",
			});

			return expect(FS.readFile(TEMP1_FILE_PATH, "utf8")).to.eventually.equal(
				smudgedFileData
			);
		});

		/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
		it("smudges the second of two clean files", async function () {
			await FS.copyFile(CLEANED_FILE_PATH, TEMP1_FILE_PATH);
			await FS.copyFile(CLEANED_FILE_PATH, TEMP2_FILE_PATH);

			await execAsync(`giismudge ${TEMP1_FILE_NAME} ${TEMP2_FILE_NAME}`, {
				cwd: "test/data",
			});

			return expect(FS.readFile(TEMP2_FILE_PATH, "utf8")).to.eventually.equal(
				smudgedFileData
			);
		});
	});
});
