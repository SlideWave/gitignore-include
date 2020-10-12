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

Install as a development dependency:

```sh
npm install --save-dev @slidewave/gitignore-include
```

Set up your trigger(s). There are several ways to go about this, including programmatic access. See the [Triggers section](#triggers) for more details.

Add `include` directives to your `.gitignore` file. These follow the following, admittedly rigid, format:

```gitignore
## <include href="https://github.com/github/gitignore/raw/master/Node.gitignore">
## </include>
```

See the [Examples section](#examples) for more details.

Also be sure to update any GitHub Actions workflow jobs that use any form of `npm install`:

```yaml
      - name: Fetch dependencies
        # Skip post-install scripts here, as a malicious script could steal NODE_AUTH_TOKEN.
        run: |
          npm ci --ignore-scripts
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GPR_READ_TOKEN }}
          NODE_ENV: ci # Override so that we get the dev dependencies.

      - name: Build dependencies
        # `npm rebuild` will run all those post-install scripts for us.
        run: npm rebuild && npm run prepare --if-present
```

## Triggers

Without a trigger the include directives are not processed. You can accomplish this several ways, a few of which are outlined below.

### Trigger on NPM prepare

Prepare works like NPM's postinstall, but only runs on the original project, not when being depended upon by another project.

Edit your `package.json` to include the following, assuming you want to run it on all the files that look like gitignore files:

```json
"prepare": "npx -q giismudge .*ignore"
```

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
