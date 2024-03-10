import { createContext } from 'preact';
import { useState, useContext, useEffect } from 'preact/hooks';

/**
 * @template Key
 * @template Value
 *
 * @typedef MapLike
 *
 * @prop {(key: Key) => boolean} has Whether map contains value for key.
 * @prop {(key: Key) => Value?} get Get value for key, if exists.
 * @prop {(key: Key, value: Value) => MapLike<Key, Value>} set Set value for key.
 * @prop {(key: Key) => boolean} delete Delete value for key, returning true if successful.
 */

/**
 * Cache entry for idle request.
 *
 * @template Data
 * @typedef CacheIdleEntry<Data>
 *
 * @prop {undefined} [status]
 * @prop {Data=} data
 * @prop {Array<import('preact/hooks').StateUpdater<any>>} subscribers
 */

/**
 * Cache entry for pending request.
 *
 * @template Data
 * @typedef CacheLoadingEntry<Data>
 *
 * @prop {'loading'} status
 * @prop {Data=} data
 * @prop {Array<import('preact/hooks').StateUpdater<any>>} subscribers
 */

/**
 * Cache entry for successful request.
 *
 * @template Data
 * @typedef CacheSuccessEntry<Data>
 *
 * @prop {'success'} status
 * @prop {Data} data
 * @prop {Array<import('preact/hooks').StateUpdater<any>>} subscribers
 */

/**
 * Cache entry for failed request.
 *
 * @template Data
 * @typedef CacheErrorEntry<Data>
 *
 * @prop {'error'} status
 * @prop {Data=} data
 * @prop {Error} error
 * @prop {Array<import('preact/hooks').StateUpdater<any>>} subscribers
 */

/**
 * Cache entry for request.
 *
 * @template Data
 * @typedef {CacheLoadingEntry<Data>
 *	| CacheSuccessEntry<Data>
 *	| CacheErrorEntry<Data>
 *	| CacheIdleEntry<Data>} CacheEntry
 */

/**
 * Data setter function signature.
 *
 * @template Data
 * @typedef {(nextData: Data) => void} SetData
 */

/**
 * Refetch function signature.
 *
 * @typedef {() => void} Refetch
 */

/**
 * Idle request result.
 *
 * @template Data
 * @typedef IdleResult<Data>
 *
 * @prop {'loading'|'success'|'error'} [status]
 * @prop {Data} [data]
 * @prop {Error} [error]
 * @prop {false} isLoading
 * @prop {false} isSuccess
 * @prop {false} isError
 * @prop {SetData<Data>} setData
 * @prop {Refetch} refetch
 */

/**
 * Pending request result.
 *
 * @template Data
 * @typedef LoadingResult<Data>
 *
 * @prop {'loading'} status
 * @prop {Data=} data
 * @prop {undefined} [error]
 * @prop {true} isLoading
 * @prop {false} isSuccess
 * @prop {false} isError
 * @prop {SetData<Data>} setData
 * @prop {Refetch} refetch
 */

/**
 * Successful request result.
 *
 * @template Data
 * @typedef SuccessResult<Data>
 *
 * @prop {'success'} status
 * @prop {Data} data
 * @prop {undefined} [error]
 * @prop {false} isLoading
 * @prop {true} isSuccess
 * @prop {false} isError
 * @prop {SetData<Data>} setData
 * @prop {Refetch} refetch
 */

/**
 * Failed request result.
 *
 * @template Data
 * @typedef ErrorResult<Data>
 *
 * @prop {'error'} status
 * @prop {Error} error
 * @prop {Data=} data
 * @prop {false} isLoading
 * @prop {false} isSuccess
 * @prop {true} isError
 * @prop {SetData<Data>} setData
 * @prop {Refetch} refetch
 */

/**
 * Current fetch status result.
 *
 * @template Data
 * @typedef {LoadingResult<Data>
 *	| SuccessResult<Data>
 *	| ErrorResult<Data>
 *	| IdleResult<Data>} Result
 */

/**
 * Fetcher implementation.
 *
 * @template Data
 * @typedef {() => Data | Promise<Data>} Fetcher
 */

/**
 * Cache implementation.
 *
 * @template Data
 * @typedef {MapLike<any, CacheEntry<Data>>} Cache
 */

/**
 * Context serving as cache state container. For most usage, you shouldn't need to interface with
 * the context object, but in advanced use-cases you can use this to substitute or scope caches.
 */
const CacheContext = createContext(/** @type {Cache<any>} */ (new Map()));

/**
 * Triggers a new fetch request as appropriate and returns a result of the current status.
 *
 * @template Data
 *
 * @param {any} key
 * @param {Fetcher<Data>} fetcher
 *
 * @return {Result<Data>}
 */
function useQuery(key, fetcher) {
	const cache = useContext(CacheContext);
	const [value, setValue] = useState(getNextValue);

	useEffect(() => {
		const { status, subscribers } = getCacheEntry();
		subscribers.push(setValue);

		if (status !== 'loading') refetch();

		return () => {
			subscribers.splice(subscribers.indexOf(setValue), 1);
			if (!subscribers.length) cache.delete(key);
		};
	}, [key]);

	/**
	 * @return {Result<Data>}
	 */
	function getNextValue() {
		const cacheEntry = getCacheEntry();

		const nextValue = /** @type {Result<Data>} */ ({
			status: cacheEntry.status,
			data: cacheEntry.data,
			isLoading: cacheEntry.status === 'loading',
			isSuccess: cacheEntry.status === 'success',
			isError: cacheEntry.status === 'error',
			setData,
			refetch,
		});

		if (nextValue.status === 'error') {
			nextValue.error = /** @type {CacheErrorEntry<Data>} */ (cacheEntry).error;
		}

		return nextValue;
	}

	/**
	 * @return {CacheEntry<Data>}
	 */
	function getCacheEntry() {
		if (!cache.has(key)) {
			cache.set(key, { subscribers: [] });
		}

		return /** @type {CacheEntry<Data>} */ (cache.get(key));
	}

	/**
	 * @param {Partial<CacheEntry<Data>>} nextCacheValuePatch
	 */
	function setCacheValue(nextCacheValuePatch) {
		const cacheEntry = getCacheEntry();

		for (const patchKey in nextCacheValuePatch) {
			// @ts-ignore
			cacheEntry[patchKey] = nextCacheValuePatch[patchKey];
		}

		const nextValue = getNextValue();
		cacheEntry.subscribers.forEach((setSubscriberValue) => {
			setSubscriberValue(nextValue);
		});
	}

	/**
	 * @param {Data} nextData
	 */
	function setData(nextData) {
		setCacheValue({ status: 'success', data: nextData });
	}

	function refetch() {
		if (key == null) {
			return;
		}

		setCacheValue({ status: 'loading' });

		Promise.resolve(fetcher())
			.then(setData)
			.catch((error) => {
				setCacheValue({
					status: 'error',
					error,
				});
			});
	}

	return value;
}

export { CacheContext, useQuery };
