# validate-peer-dependencies

A utility to allow packages to validate that their specified `peerDependencies` are properly satisified.

## Why?

`peerDependencies` are actually a pretty important mechanism when working with
"plugin systems". For example, most of the packages in the `@babel` namespace
will declare a peer dependency on the version of `@babel/core` that they
require to be present.

Unfortunately, for quite a long time `peerDependencies` were very poorly
supported in the Node ecosystem. Neither `npm` nor `yarn` would automatically
install peer dependencies (`npm@3` `peerDependencies` removed "auto
installation" of `peerDependencies`). They wouldn't even validate that the specified
peer dependency was satisfied (both `npm` and `yarn` would emit a console
warning, which is **very very** often completely ignored).

Finally now with `npm@7` adding back support for installing `peerDependencies`
automatically we are moving in the right direction. Unfortunately, many of us
have projects that must still support older `npm` versions (or `yarn` versions)
that do not provide that installation support.

**That** is where this project comes in. It aims to provide a **_fast_** and **_easy_**
way to validate that your required peer dependencies are satisified.

## Usage

The simplest usage of `validatePeerDependencies` would look like the following:

```js
require('validate-peer-dependencies')(__dirname);
```

This simple invocation will do the following:

* find the nearest `package.json` file from the specified path (in this case `__dirname`)
* read that `package.json` to find any specified `peerDependencies` entries
* ensure that *each* of the specified `peerDependencies` are present and that
  the installed versions match the semver ranges that were specified
* if any of the `peerDependencies` were not present or if their ranges were not satisified
  throw a useful error

Here is an example error message:

```
test-app has the following unmet peerDependencies:

  * bar: `>= 2`; it was not installed
  * foo: `> 1`; it was resolved to `1.0.0`
```

### Options

A few custom options are available for use:

* `cache` - Can be `false` to disable caching, or a `Map` instance to use your own custom cache
* `handleFailure` - A callback function that will be invoked if validation fails

#### `cache`

Pass this option to either prevent caching completely (useful in testing
scenarios), or to provide a custom cache.

```js
const validatePeerDependencies = require('validate-peer-dependencies');

// completely disable caching
validatePeerDependencies(__dirname, { cache: false });

// instruct caching system to leverage your own cache
const cache = new Map();
validatePeerDependencies(__dirname, { cache });
```

#### `handleFailure`

By default, `validatePeerDependencies` emits an error that looks like:

```
test-app has the following unmet peerDependencies:

  * bar: `>= 2`; it was not installed
  * foo: `> 1`; it was resolved to `1.0.0`
```

If you would like to customize the error message (or handle the failure in a
different way), you can provide a custom `handleFailure` callback.

The callback will be passed in a result object with the following interface:

```ts
interface IncompatibleDependency {
  /**
    The name of the package that was incompatible.
  */
  name: string;

  /**
    The peer dependency range that was specified.
  */
  specifiedPeerDependencyRange: string;

  /**
    The version that was actually found.
  */
  version: string;
}

interface MissingPeerDependency {
  /**
    The name of the package that was incompatible.
  */
  name: string;

  /**
    The peer dependency range that was specified.
  */
  specifiedPeerDependencyRange: string;
}

interface Result {
  /**
    The `package.json` contents that were resolved from the specified root
    directory.
  */
  pkg: unknown;

  /**
    The path to the `package.json` that was resolved from the specified root
    directory.
  */
  packagePath: string;

  /**
    The list of peer dependencies that were not found.
  */
  incompatibleRanges: IncompatibleDependency[];

  /**
    The list of peer dependencies that were found, but did not match the
    specified semver range.
  */
  missingPeerDependencies: MissingPeerDependency[];
}
```

For example, this is how you might override the default error message to customize:

```js
validatePeerDependencies(__dirname, {
  handleFailure(result) {
    let { missingPeerDependencies, incompatibleRanges } = result;

    let missingPeerDependenciesMessage = (missingPeerDependencies || []).reduce(
      (message, metadata) => {
        return `${message}\n\t* ${metadata.name}: \`${metadata.specifiedPeerDependencyRange}\`; it was not installed`;
      },
      ''
    );

    let incompatiblePeerDependenciesMessage = (incompatibleRanges || []).reduce(
      (message, metadata) => {
        return `${message}\n\t* ${metadata.name}: \`${metadata.specifiedPeerDependencyRange}\`; it was resolved to \`${metadata.version}\``;
      },
      ''
    );

    throw new Error(
      `${result.pkg.name} has the following unmet peerDependencies:\n${missingPeerDependenciesMessage}${incompatiblePeerDependenciesMessage}`
    );
  },
});
```

## License

This project is licensed under the [MIT License](LICENSE.md).
