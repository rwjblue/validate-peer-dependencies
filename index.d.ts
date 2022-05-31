export type IncompatibleRange = {
  name: string;
  version: string;
  specifiedPeerDependencyRange: string;
};
export type MissingPeerDependency = {
  name: string;
  specifiedPeerDependencyRange: string;
};
export type CachedPkg = {
  pkg: object;
  packagePath: string;
  incompatibleRanges: null | IncompatibleRange[];
  missingPeerDependencies: null | MissingPeerDependency[];
};
export type CachedValue = true | CachedPkg;
export type Options = {
  cache?: boolean | Map<string, CachedValue>;
  handleFailure?: (result: CachedValue) => any;
  resolvePeerDependenciesFrom?: string;
};

declare const validatePeerDependencies: {
  (parentRoot: string, options?: Options): void;

  assumeProvided(pkg: { name?: string; version?: string }): void;
  _resetCache(): void;
  _resetAssumptions(): void;
  __HasPeerDepsInstalled: Map<string, CachedValue>;
};

export default validatePeerDependencies;
