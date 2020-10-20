const Project = require('fixturify-project');
const validatePeerDependencies = require('./index');

const ROOT = process.cwd();

describe('validate-peer-dependencies', function () {
  let project;

  beforeEach(() => {
    project = new Project('test-app');
  });

  afterEach(async () => {
    await project.dispose();

    process.chdir(ROOT);
  });

  it('throws an error when peerDependencies are not present', () => {
    project.pkg.peerDependencies = {
      foo: '> 1',
    };

    project.writeSync();

    expect(() => validatePeerDependencies(project.baseDir))
      .toThrowErrorMatchingInlineSnapshot(`
      "test-app has the following unmet peerDependencies:

      	* foo: \`> 1\`; it was not installed"
    `);
  });

  it('throws an error when an entry is in peerDependencies **and** in dependencies', () => {
    project.pkg.peerDependencies = {
      foo: '>= 1',
    };
    project.addDependency('foo', '1.0.0');
    project.writeSync();

    process.chdir(project.root);

    expect(() => validatePeerDependencies(project.baseDir))
      .toThrowErrorMatchingInlineSnapshot(`
      "test-app (at \`./test-app\`) is improperly configured:

      	* foo: included both as dependency and as a peer dependency"
    `);
  });

  it('throws an error when peerDependencies are present but at the wrong version', () => {
    project.pkg.peerDependencies = {
      foo: '> 1',
    };

    project.addDevDependency('foo', '1.0.0');
    project.writeSync();

    expect(() => validatePeerDependencies(project.baseDir))
      .toThrowErrorMatchingInlineSnapshot(`
      "test-app has the following unmet peerDependencies:

      	* foo: \`> 1\`; it was resolved to \`1.0.0\`"
    `);
  });

  it('throws an error when peerDependencies that are optional are present but at the wrong version', () => {
    project.pkg.peerDependencies = {
      foo: '> 1',
    };
    project.pkg.peerDependenciesMeta = {
      foo: {
        optional: true,
      },
    };

    project.addDevDependency('foo', '1.0.0');
    project.writeSync();

    expect(() => validatePeerDependencies(project.baseDir))
      .toThrowErrorMatchingInlineSnapshot(`
      "test-app has the following unmet peerDependencies:

      	* foo: \`> 1\`; it was resolved to \`1.0.0\`"
    `);
  });

  it('throws if some peerDependencies are met and others are missing', () => {
    project.pkg.peerDependencies = {
      foo: '> 1',
      bar: '>= 2',
    };

    project.addDevDependency('foo', '2.0.0');
    project.writeSync();

    expect(() => validatePeerDependencies(project.baseDir))
      .toThrowErrorMatchingInlineSnapshot(`
      "test-app has the following unmet peerDependencies:

      	* bar: \`>= 2\`; it was not installed"
    `);
  });

  it('throws if some peerDependencies are met and others are on an unsupported version', () => {
    project.pkg.peerDependencies = {
      foo: '> 1',
      bar: '>= 2',
    };

    project.addDevDependency('foo', '2.0.0');
    project.addDevDependency('bar', '1.0.0');
    project.writeSync();

    expect(() => validatePeerDependencies(project.baseDir))
      .toThrowErrorMatchingInlineSnapshot(`
      "test-app has the following unmet peerDependencies:

      	* bar: \`>= 2\`; it was resolved to \`1.0.0\`"
    `);
  });

  it('throws when some peerDependencies are missing and some are outdated', () => {
    project.pkg.peerDependencies = {
      foo: '> 1',
      bar: '>= 2',
    };

    project.addDevDependency('foo', '1.0.0');
    project.writeSync();

    expect(() => validatePeerDependencies(project.baseDir))
      .toThrowErrorMatchingInlineSnapshot(`
      "test-app has the following unmet peerDependencies:

      	* bar: \`>= 2\`; it was not installed
      	* foo: \`> 1\`; it was resolved to \`1.0.0\`"
    `);
  });

  it('does not throw when peerDependencies are satisfied', () => {
    project.pkg.peerDependencies = {
      foo: '>= 1',
    };

    project.addDevDependency('foo', '1.0.0');
    project.writeSync();

    validatePeerDependencies(project.baseDir);
  });

  it('does not throw when peerDependencies are optional', () => {
    project.pkg.peerDependencies = {
      foo: '>= 1',
    };

    project.pkg.peerDependenciesMeta = {
      foo: {
        optional: true,
      },
    };

    project.writeSync();

    validatePeerDependencies(project.baseDir);
  });

  it('errors with a helpful message when the provided project root does not contain a package.json', () => {
    expect(() => {
      validatePeerDependencies(project.baseDir);
    }).toThrowError(
      `validate-peer-dependencies could not find a package.json when resolving upwards from:\n\t${project.baseDir}`
    );
  });

  it('allows prerelease ranges that are greater than the specified set', () => {
    project.pkg.peerDependencies = {
      foo: '>= 1',
      bar: '^2.0.0',
    };

    project.addDevDependency('foo', '1.1.0-beta.1');
    project.addDevDependency('bar', '2.1.0-alpha.1');
    project.writeSync();

    validatePeerDependencies(project.baseDir);
  });

  describe('resolvePeerDependenciesFrom', () => {
    it('when resolvePeerDependenciesFrom is provided the cached results are independent of usages without resolvePeerDependenciesFrom for the same parentRoot', () => {
      let linkedPackage = new Project('foo');

      try {
        linkedPackage.pkg.peerDependencies = {
          bar: '^1.0.0',
        };
        linkedPackage.writeSync();

        project.addDevDependency('bar', '1.0.0');
        project.writeSync();

        validatePeerDependencies(linkedPackage.baseDir, {
          resolvePeerDependenciesFrom: project.baseDir,
        });

        expect(() => validatePeerDependencies(linkedPackage.baseDir))
          .toThrowErrorMatchingInlineSnapshot(`
          "foo has the following unmet peerDependencies:

          	* bar: \`^1.0.0\`; it was not installed"
        `);
      } finally {
        linkedPackage.dispose();
      }
    });

    it('can provide custom base directory for peerDependency resolution (for linking situations)', () => {
      let linkedPackage = new Project('foo');

      try {
        linkedPackage.pkg.peerDependencies = {
          bar: '^1.0.0',
        };
        linkedPackage.writeSync();

        project.addDevDependency('bar', '1.0.0');
        project.writeSync();

        validatePeerDependencies(linkedPackage.baseDir, {
          resolvePeerDependenciesFrom: project.baseDir,
        });
      } finally {
        linkedPackage.dispose();
      }
    });
  });

  describe('caching', () => {
    it('caches failure to find package.json from parentRoot by default', () => {
      expect(() => {
        validatePeerDependencies(project.baseDir);
      }).toThrowError(
        `validate-peer-dependencies could not find a package.json when resolving upwards from:\n\t${project.baseDir}`
      );
    });

    it('can prevent caching failure to find package.json from parentRoot with cache: false', () => {
      expect(() => {
        validatePeerDependencies(project.baseDir, { cache: false });
      }).toThrowError(
        `validate-peer-dependencies could not find a package.json when resolving upwards from:\n\t${project.baseDir}`
      );

      project.writeSync();
      validatePeerDependencies(project.baseDir, { cache: false });
    });

    it('caches succesfull results by default', () => {
      project.pkg.peerDependencies = {
        foo: '>= 1',
      };

      project.addDevDependency('foo', '1.0.0');
      project.writeSync();

      validatePeerDependencies(project.baseDir);

      // TODO: expose a public API to fixturify-project to remove deps/devDeps?
      delete project._devDependencies.foo;
      project.writeSync();

      // does not error because it was cached
      validatePeerDependencies(project.baseDir);
    });

    it('caches failures by default', () => {
      project.pkg.peerDependencies = {
        foo: '>= 1',
      };

      project.writeSync();

      expect(() => validatePeerDependencies(project.baseDir))
        .toThrowErrorMatchingInlineSnapshot(`
        "test-app has the following unmet peerDependencies:

        	* foo: \`>= 1\`; it was not installed"
      `);

      project.addDevDependency('foo', '1.0.0');
      project.writeSync();

      expect(() => validatePeerDependencies(project.baseDir))
        .toThrowErrorMatchingInlineSnapshot(`
        "test-app has the following unmet peerDependencies:

        	* foo: \`>= 1\`; it was not installed"
      `);
    });

    it('can prevent caching by passing `cache: false` option', () => {
      project.pkg.peerDependencies = {
        foo: '>= 1',
      };

      project.writeSync();

      expect(() =>
        validatePeerDependencies(project.baseDir, {
          cache: false,
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        "test-app has the following unmet peerDependencies:

        	* foo: \`>= 1\`; it was not installed"
      `);

      project.addDevDependency('foo', '1.0.0');
      project.writeSync();

      validatePeerDependencies(project.baseDir);
    });

    it('provide its own cache', () => {
      let cache = new Map();
      project.pkg.peerDependencies = {
        foo: '>= 1',
      };

      project.writeSync();

      expect(() =>
        validatePeerDependencies(project.baseDir, {
          cache,
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        "test-app has the following unmet peerDependencies:

        	* foo: \`>= 1\`; it was not installed"
      `);

      expect(cache.size).toEqual(1);
    });
  });

  describe('handleFailure', () => {
    it('provide its own handleFailure', () => {
      expect.hasAssertions();

      project.pkg.peerDependencies = {
        foo: '>= 1',
        bar: '>= 2',
      };

      project.addDevDependency('bar', '1.0.0');
      project.writeSync();

      validatePeerDependencies(project.baseDir, {
        handleFailure(result) {
          expect(result).toMatchInlineSnapshot(
            {
              packagePath: expect.stringMatching('test-app/package.json'),
            },
            `
            Object {
              "incompatibleRanges": Array [
                Object {
                  "name": "bar",
                  "specifiedPeerDependencyRange": ">= 2",
                  "version": "1.0.0",
                },
              ],
              "missingPeerDependencies": Array [
                Object {
                  "name": "foo",
                  "specifiedPeerDependencyRange": ">= 1",
                },
              ],
              "packagePath": StringMatching /test-app\\\\/package\\.json/,
              "pkg": Object {
                "dependencies": Object {},
                "devDependencies": Object {
                  "bar": "1.0.0",
                },
                "keywords": Array [],
                "name": "test-app",
                "peerDependencies": Object {
                  "bar": ">= 2",
                  "foo": ">= 1",
                },
                "version": "0.0.0",
              },
            }
          `
          );
        },
      });
    });
  });
});
