'use strict';

const resolvePackagePath = require('resolve-package-path');
const semver = require('semver');

// avoid checking multiple times from the same location
const HasPeerDepsInstalled = new Map();

const NullCache = new (class NullCache {
  get() {}
  set() {}
  has() {
    return false;
  }
})();

function throwUsefulError(result) {
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
}

module.exports = function validatePeerDependencies(parentRoot, options = {}) {
  let { cache, handleFailure } = options;

  if (cache === false) {
    cache = NullCache;
  } else if (cache === undefined || cache === true) {
    cache = HasPeerDepsInstalled;
  }

  if (typeof handleFailure !== 'function') {
    handleFailure = throwUsefulError;
  }

  if (cache.has(parentRoot)) {
    let result = cache.get(parentRoot);
    if (result !== true) {
      handleFailure(result);
    }
    return;
  }

  let packagePath = resolvePackagePath.findUpPackagePath(
    parentRoot,
    cache === NullCache ? false : undefined
  );

  if (packagePath === null) {
    throw new Error(
      `validate-peer-dependencies could not find a package.json when resolving upwards from:\n\t${parentRoot}.`
    );
  }

  let pkg = require(packagePath);
  let { peerDependencies } = pkg;

  // lazily created as needed
  let missingPeerDependencies = null;
  let incompatibleRanges = null;

  for (let packageName in peerDependencies) {
    //   foo-package: >= 1.9.0 < 2.0.0
    //   foo-package: >= 1.9.0
    //   foo-package: ^1.9.0
    let specifiedPeerDependencyRange = peerDependencies[packageName];

    let peerDepPackagePath = resolvePackagePath(
      packageName,
      parentRoot,
      cache === NullCache ? false : undefined
    );
    if (peerDepPackagePath === null) {
      if (missingPeerDependencies === null) {
        missingPeerDependencies = [];
      }

      missingPeerDependencies.push({
        name: packageName,
        specifiedPeerDependencyRange,
      });

      continue;
    }

    let foundPkg = require(peerDepPackagePath);
    if (
      !semver.satisfies(foundPkg.version, specifiedPeerDependencyRange, {
        includePrerelease: true,
      })
    ) {
      if (incompatibleRanges === null) {
        incompatibleRanges = [];
      }

      incompatibleRanges.push({
        name: packageName,
        version: foundPkg.version,
        specifiedPeerDependencyRange,
      });

      continue;
    }
  }

  let found = missingPeerDependencies === null && incompatibleRanges === null;

  let result;
  if (found) {
    result = true;
  } else {
    result = {
      pkg,
      packagePath,
      missingPeerDependencies,
      incompatibleRanges,
    };
  }

  cache.set(parentRoot, result);

  if (result !== true) {
    handleFailure(result);
  }
};

Object.defineProperty(module.exports, '__HasPeerDepsInstalled', {
  enumerable: false,
  configurable: false,
  value: HasPeerDepsInstalled,
});

module.exports._resetCache = function () {
  HasPeerDepsInstalled.clear();
};
