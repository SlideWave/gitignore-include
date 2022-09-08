# gitignore Include

Providing the missing link between your .gitignore file and any collection of gitignore samples - including the famous GitHub [gitignore project]("https://github.com/github/gitignore)!

## Examples

Basic format for GitHub's [gitignore project]("https://github.com/github/gitignore):

```gitignore
## <include href="https://github.com/github/gitignore/raw/main/Global/Images.gitignore">
# Anything in here will be replaced and updated when you want it to be.
## </include>

# Anything not between the tags is ignored.
whatever/else
```

A local file:

```gitignore
## <include href="file://./other.example">
## </include>
```

Please note that recursive definitions are not yet supported: aka a file including another file that includes something else. That said PRs to solve this and other issues are welcome!

## Installation

Install as a development dependency:

```sh
npm install --save-dev @slidewave/gitignore-include
```

Set up your trigger(s). There are several ways to go about this, including programmatic access. See the [Triggers section](#triggers) for more details.

Add `include` directives to your `.gitignore` file. These follow the following, admittedly rigid, format:

```gitignore
## <include href="https://github.com/github/gitignore/raw/main/Node.gitignore">
## </include>
```

See the [Examples section](#examples) for more details.

## Triggers

Without a trigger the include directives are not processed. You can accomplish this several ways, a few of which are outlined below.

### Trigger with [lint-staged](https://github.com/okonet/lint-staged)

There are multiple ways to configure lint-staged, but one of the most common is via the `package.json` configuration. Thus adding the following to your `package.json` will make sure that every time lint-staged is called, and if you've modified the ignore files, that they are re-smudged correctly:

```json
"lint-staged": {
    ".*ignore": "giismudge"
}
```

### Trigger on NPM prepare

Prepare works like NPM's postinstall, but only runs on the original project, not when being depended upon by another project.

Edit your `package.json` to include the following, assuming you want to run it on all the files that look like gitignore files:

```json
"prepare": "npx -q giismudge .*ignore"
```

However since this only happens when you install the packages, it's not recommended.

## Running manually

To update/fix your local files you can run the smudging utility manually via

```sh
npx giismudge .*ignore
```

assuming you have either installed locally as recommended above, or globally.

You can remove all auto-inserted ignore values from your files via

```sh
npx giiclean .*ignore
```

If you want to run without installing you can do so by using the project parameter of `npx`:

```sh
npx -p @slidewave/gitignore-include giismudge .*ignore
```
