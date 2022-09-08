const { Project } = require('fixturify-project');
const path = require('path');
const os = require('os');
const fs = require('fs');
const validatePeerDependencies = require('./index');
const { assumeProvided, _resetAssumptions } = validatePeerDependencies;

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

  it('throws an error when peerDependencies are not present', async () => {
    project.pkg.peerDependencies = {
      foo: '> 1',
    };

    await project.write();

    expect(() => validatePeerDependencies(project.baseDir))
      .toThrowErrorMatchingInlineSnapshot(`
      "test-app has the following unmet peerDependencies:

      	* foo: \`> 1\`; it was not installed"
    `);
  });

  it('throws an error when an entry is in peerDependencies **and** in dependencies', async () => {
    project.pkg.peerDependencies = {
      foo: '>= 1',
    };
    project.addDependency('foo', '1.0.0');
    await project.write();

    process.chdir(project.baseDir);

    expect(() => validatePeerDependencies(project.baseDir))
      .toThrowErrorMatchingInlineSnapshot(`
      "test-app (at \`./\`) is improperly configured:

      	* foo: included both as dependency and as a peer dependency"
    `);
  });

  it('throws an error when peerDependencies are present but at the wrong version', async () => {
    project.pkg.peerDependencies = {
      foo: '> 1',
    };

    project.addDevDependency('foo', '1.0.0');
    await project.write();

    expect(() => validatePeerDependencies(project.baseDir))
      .toThrowErrorMatchingInlineSnapshot(`
      "test-app has the following unmet peerDependencies:

      	* foo: \`> 1\`; it was resolved to \`1.0.0\`"
    `);
  });

  it('throws an error when peerDependencies that are optional are present but at the wrong version', async () => {
    project.pkg.peerDependencies = {
      foo: '> 1',
    };
    project.pkg.peerDependenciesMeta = {
      foo: {
        optional: true,
      },
    };

    project.addDevDependency('foo', '1.0.0');
    await project.write();

    expect(() => validatePeerDependencies(project.baseDir))
      .toThrowErrorMatchingInlineSnapshot(`
      "test-app has the following unmet peerDependencies:

      	* foo: \`> 1\`; it was resolved to \`1.0.0\`"
    `);
  });

  it('throws if some peerDependencies are met and others are missing', async () => {
    project.pkg.peerDependencies = {
      foo: '> 1',
      bar: '>= 2',
    };

    project.addDevDependency('foo', '2.0.0');
    await project.write();

    expect(() => validatePeerDependencies(project.baseDir))
      .toThrowErrorMatchingInlineSnapshot(`
      "test-app has the following unmet peerDependencies:

      	* bar: \`>= 2\`; it was not installed"
    `);
  });

  it('throws if some peerDependencies are met and others are on an unsupported version', async () => {
    project.pkg.peerDependencies = {
      foo: '> 1',
      bar: '>= 2',
    };

    project.addDevDependency('foo', '2.0.0');
    project.addDevDependency('bar', '1.0.0');
    await project.write();

    expect(() => validatePeerDependencies(project.baseDir))
      .toThrowErrorMatchingInlineSnapshot(`
      "test-app has the following unmet peerDependencies:

      	* bar: \`>= 2\`; it was resolved to \`1.0.0\`"
    `);
  });

  it('throws when some peerDependencies are missing and some are outdated', async () => {
    project.pkg.peerDependencies = {
      foo: '> 1',
      bar: '>= 2',
    };

    project.addDevDependency('foo', '1.0.0');
    await project.write();

    expect(() => validatePeerDependencies(project.baseDir))
      .toThrowErrorMatchingInlineSnapshot(`
      "test-app has the following unmet peerDependencies:

      	* bar: \`>= 2\`; it was not installed
      	* foo: \`> 1\`; it was resolved to \`1.0.0\`"
    `);
  });

  it('does not throw when peerDependencies are satisfied', async () => {
    project.pkg.peerDependencies = {
      foo: '>= 1',
    };

    project.addDevDependency('foo', '1.0.0');
    await project.write();

    validatePeerDependencies(project.baseDir);
  });

  it('does not throw when peerDependencies are optional', async () => {
    project.pkg.peerDependencies = {
      foo: '>= 1',
    };

    project.pkg.peerDependenciesMeta = {
      foo: {
        optional: true,
      },
    };

    await project.write();

    validatePeerDependencies(project.baseDir);
  });

  it('errors with a helpful message when the provided project root does not contain a package.json', async () => {
    let tmpdir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'fake-project-')
    );

    expect(() => {
      validatePeerDependencies(tmpdir);
    }).toThrowError(
      `validate-peer-dependencies could not find a package.json when resolving upwards from:\n\t${tmpdir}`
    );
  });

  it('allows prerelease ranges that are greater than the specified set', async () => {
    project.pkg.peerDependencies = {
      foo: '>= 1',
      bar: '^2.0.0',
    };

    project.addDevDependency('foo', '1.1.0-beta.1');
    project.addDevDependency('bar', '2.1.0-alpha.1');
    await project.write();

    validatePeerDependencies(project.baseDir);
  });

  describe('resolvePeerDependenciesFrom', () => {
    it('when resolvePeerDependenciesFrom is provided the cached results are independent of usages without resolvePeerDependenciesFrom for the same parentRoot', async () => {
      let linkedPackage = new Project('foo');

      try {
        linkedPackage.pkg.peerDependencies = {
          bar: '^1.0.0',
        };
        await linkedPackage.write();

        project.addDevDependency('bar', '1.0.0');
        await project.write();

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

    it('can provide custom base directory for peerDependency resolution (for linking situations)', async () => {
      let linkedPackage = new Project('foo');

      try {
        linkedPackage.pkg.peerDependencies = {
          bar: '^1.0.0',
        };
        await linkedPackage.write();

        project.addDevDependency('bar', '1.0.0');
        await project.write();

        validatePeerDependencies(linkedPackage.baseDir, {
          resolvePeerDependenciesFrom: project.baseDir,
        });
      } finally {
        linkedPackage.dispose();
      }
    });
  });

  describe('caching', () => {
    it('caches failure to find package.json from parentRoot by default', async () => {
      let tmpdir = await fs.promises.mkdtemp(
        path.join(os.tmpdir(), 'fake-project-')
      );

      expect(() => {
        validatePeerDependencies(tmpdir);
      }).toThrowError(
        `validate-peer-dependencies could not find a package.json when resolving upwards from:\n\t${tmpdir}`
      );
    });

    it('can prevent caching failure to find package.json from parentRoot with cache: false', async () => {
      let tmpdir = await fs.promises.mkdtemp(
        path.join(os.tmpdir(), 'fake-project-')
      );
      project.baseDir = tmpdir;

      expect(() => {
        validatePeerDependencies(project.baseDir, { cache: false });
      }).toThrowError(
        `validate-peer-dependencies could not find a package.json when resolving upwards from:\n\t${project.baseDir}`
      );

      await project.write();
      validatePeerDependencies(project.baseDir, { cache: false });
    });

    it('caches succesfull results by default', async () => {
      project.pkg.peerDependencies = {
        foo: '>= 1',
      };

      project.addDevDependency('foo', '1.0.0');
      await project.write();

      validatePeerDependencies(project.baseDir);

      // TODO: expose a public API to fixturify-project to remove deps/devDeps?
      delete project._devDependencies.foo;
      await project.write();

      // does not error because it was cached
      validatePeerDependencies(project.baseDir);
    });

    it('caches failures by default', async () => {
      project.pkg.peerDependencies = {
        foo: '>= 1',
      };

      await project.write();

      expect(() => validatePeerDependencies(project.baseDir))
        .toThrowErrorMatchingInlineSnapshot(`
        "test-app has the following unmet peerDependencies:

        	* foo: \`>= 1\`; it was not installed"
      `);

      project.addDevDependency('foo', '1.0.0');
      await project.write();

      expect(() => validatePeerDependencies(project.baseDir))
        .toThrowErrorMatchingInlineSnapshot(`
        "test-app has the following unmet peerDependencies:

        	* foo: \`>= 1\`; it was not installed"
      `);
    });

    it('can prevent caching by passing `cache: false` option', async () => {
      project.pkg.peerDependencies = {
        foo: '>= 1',
      };

      await project.write();

      expect(() =>
        validatePeerDependencies(project.baseDir, {
          cache: false,
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        "test-app has the following unmet peerDependencies:

        	* foo: \`>= 1\`; it was not installed"
      `);

      project.addDevDependency('foo', '1.0.0');
      await project.write();

      validatePeerDependencies(project.baseDir);
    });

    it('provide its own cache', async () => {
      let cache = new Map();
      project.pkg.peerDependencies = {
        foo: '>= 1',
      };

      await project.write();

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
    it('provide its own handleFailure', async () => {
      expect.hasAssertions();

      project.pkg.peerDependencies = {
        foo: '>= 1',
        bar: '>= 2',
      };

      project.addDevDependency('bar', '1.0.0');
      await project.write();

      validatePeerDependencies(project.baseDir, {
        handleFailure(result) {
          expect(result).toMatchInlineSnapshot(
            {
              packagePath: expect.stringMatching('package.json'),
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
              "packagePath": StringMatching /package\\.json/,
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

describe('assumeProvided', function () {
  let project;

  beforeEach(() => {
    project = new Project('test-app');
  });

  afterEach(async () => {
    _resetAssumptions();
    await project.dispose();

    process.chdir(ROOT);
  });

  it('throws if passed an object that lacks either name or version', async function () {
    expect(() => assumeProvided()).toThrowErrorMatchingInlineSnapshot(
      `"assumeProvided({ name, version}): name and version are required, but name='undefined' version='undefined'"`
    );

    expect(() =>
      assumeProvided({ name: 'best package' })
    ).toThrowErrorMatchingInlineSnapshot(
      `"assumeProvided({ name, version}): name and version are required, but name='best package' version='undefined'"`
    );

    expect(() =>
      assumeProvided({ version: '5.0.1' })
    ).toThrowErrorMatchingInlineSnapshot(
      `"assumeProvided({ name, version}): name and version are required, but name='undefined' version='5.0.1'"`
    );
  });

  it('can be used to provide satisfy missing peer dependencies', async function () {
    project.pkg.peerDependencies = {
      foo: '> 1',
    };

    await project.write();

    expect(() => validatePeerDependencies(project.baseDir, { cache: false }))
      .toThrowErrorMatchingInlineSnapshot(`
      "test-app has the following unmet peerDependencies:

      	* foo: \`> 1\`; it was not installed"
    `);

    assumeProvided({
      name: 'foo',
      version: '2.0.0',
    });

    // now it doesn't throw
    validatePeerDependencies(project.baseDir, { cache: false });
  });

  it('uses the last value provided', async function () {
    project.pkg.peerDependencies = {
      foo: '> 1',
    };

    await project.write();

    assumeProvided({
      name: 'foo',
      version: '0.5.0',
    });

    assumeProvided({
      name: 'foo',
      version: '2.0.0',
    });

    validatePeerDependencies(project.baseDir);
  });

  it('supersedes resolution', async function () {
    project.pkg.peerDependencies = {
      foo: '>= 1',
    };

    project.addDevDependency('foo', '1.0.0');
    await project.write();

    validatePeerDependencies(project.baseDir, { cache: false });

    assumeProvided({
      name: 'foo',
      version: '0.5.0',
    });

    // the assumption takes priority over anything resolvable, so now we
    // consider the peer dependency unmet
    expect(() => validatePeerDependencies(project.baseDir, { cache: false }))
      .toThrowErrorMatchingInlineSnapshot(`
      "test-app has the following unmet peerDependencies:

      	* foo: \`>= 1\`; it was resolved to \`0.5.0\`"
    `);
  });

  it('does not prevent other peer dependencies from being validated', async function () {
    project.pkg.peerDependencies = {
      foo: '>= 1',
      bar: '> 41',
    };

    project.addDevDependency('foo', '1.0.0');
    await project.write();

    assumeProvided({
      name: 'bar',
      version: '42.0.1',
    });

    // making assumptions about bar does not interfere with resolving foo
    validatePeerDependencies(project.baseDir, { cache: false });
  });
});
