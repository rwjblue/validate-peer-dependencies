const path = require('path');
const Project = require('fixturify-project');
const validatePeerDependencies = require('./index');

describe('validate-peer-dependencies', function () {
  let project;

  beforeEach(() => {
    project = new Project('test-app');
  });

  afterEach(() => {
    project.dispose();
  });

  it('throws an error when peerDependencies are not present', () => {
    project.pkg.peerDependencies = {
      foo: '> 1',
    };

    project.writeSync();

    expect(() =>
      validatePeerDependencies(path.join(project.baseDir, 'package.json'))
    ).toThrowErrorMatchingInlineSnapshot(`
      "test-app has the following unmet peerDependencies:

      	* foo: \`> 1\`; it was not installed"
    `);
  });

  it.todo('bans usage of versions _like_ `^3.22.0`');

  it('can prevent caching', () => {
    expect('implemented').toEqual(true);
  });

  it('provide its own cache', () => {
    expect('implemented').toEqual(true);
  });

  it('provide its own handleFailure', () => {

  });
});
