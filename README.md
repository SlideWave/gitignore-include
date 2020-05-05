# gitignore Include

Providing the missing link between your .gitignore file and any collection of gitignore samples - including the famous GitHub gitignore project!

## Examples

Basic format for GitHub's gitignore project:

```gitignore
## <include href="https://github.com/github/gitignore/raw/master/Global/Images.gitignore">
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

Firstly [authenticate NPM with GitHub](https://help.github.com/en/packages/using-github-packages-with-your-projects-ecosystem/configuring-npm-for-use-with-github-packages#authenticating-to-github-packages).

Add the repository to your `.npmrc`:

```npmrc
registry=https://npm.pkg.github.com/SlideWave
```

Install as a development dependency:

```sh
npm install --save-dev @SlideWave/gitignore-include
```

Set up your trigger(s). There are several ways to go about this, including programmatic access. See the [Triggers section](#triggers) for more details.

Lastly add `include` directives to your `.gitignore` file. These follow the following, admittedly rigid, format:

```gitignore
## <include href="https://github.com/github/gitignore/raw/master/Node.gitignore">
## </include>
```

See the [Examples section](#examples) for more details.

## Triggers

Without a trigger the include directives are not processed. You can accomplish this several ways, a few of which are outlined below.

### Trigger on NPM prepare

Prepare works like NPM's postinstall, but only runs on the original project, not when being depended upon by another project.

Edit your `package.json` to include the following, assuming you want to run it on all the files that look like gitignore files:

```json
"prepare": "npx -q giismudge .*ignore"
```
