# Preact Fetching

Preact hooks for asynchronous data fetching.

_Note:_ This project is currently in an early prerelease status, and breaking changes to the API may still occur until a 1.0 release.

## Features

- **Promise-based data fetching**. Unopinionated about the source of your data.
- **Small bundle size**. Less than 0.5kb minified and gzipped.
- **TypeScript support**. Respects the resolved type of your fetcher implementation.
- **Configurable global cache**. All components share the same data by distinct keys.

## Example

```js
import { useQuery } from 'preact-fetching';

function GitHubStars({ owner, repo }) {
	const { isLoading, isError, error, data } = useQuery(#[owner, repo], async () => {
		const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
		const data = await response.json();
		return data.stargazers_count;
	});

	if (isError) {
		return `An error occurred! ${error.message}`;
	}

	if (isLoading) {
		return 'Loading...';
	}

	return `Count: ${data}`;
}
```

`useQuery` accepts two arguments:

- A key to uniquely identify the data being fetched.
- A function which fetches the data and returns either a promise or the resulting data.

The fetching function will be called any time a component is mounted and there is not already a fetch in progress for that key. Requests are deduplicated if many components are mounted at the same time which reference the same data. Data is refetched if when future components are mounted using that same key, during which time the stale data will still be available.

The default cache behavior uses a simple [`Map` object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) to reference cached values by key. For array or object values, you can consider one of the following:

- As in the example above, using the experimental [records and tuples feature](https://github.com/tc39/proposal-record-tuple).
- Changing the cache to one which implements the Map interface, but supports deep object equivalency (for example, [EquivalentKeyMap](https://github.com/aduth/equivalent-key-map)).

## Installation

Install using [NPM](https://www.npmjs.com/) or [Yarn](https://yarnpkg.com/):

```
npm install preact-fetching
```

```
yarn add preact-fetching
```

## API

### `useQuery`

```ts
function useQuery<Data>(
	key: any,
	fetcher: () => Data | Promise<Data>
): LoadingResult<Data> | SuccessResult<Data> | ErrorResult<Data> | IdleResult<Data>;
```

Triggers a new fetch request as appropriate and returns a result of the current status.

### `CacheContext`

```ts
let CacheContext: import('preact').Context<MapLike<
	any,
	CacheLoadingEntry<any> | CacheSuccessEntry<any> | CacheErrorEntry<any> | CacheIdleEntry<any>
>>;
```

Context serving as cache state container. For most usage, you shouldn't need to interface with the context object, but in advanced use-cases you can use this to substitute or scope caches.

## Project Goals and Non-Goals

### Goals:

- Lack of configurability as a feature, preferring smart defaults and a minimal-but-flexible API over a multitude of settings.
- Efficiency in bundle size, performance, and cache invalidations. Micro-optimizations and code golf are welcome.

### Non-goals:

- Feature parity with similar libraries (swr, react-query, etc.).

## License

Copyright 2020 Andrew Duthie

Released under the MIT License. See [LICENSE.md](./LICENSE.md).
