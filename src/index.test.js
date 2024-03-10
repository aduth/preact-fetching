import { describe, before, after, it, mock } from 'node:test';
import assert from 'node:assert';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { createElement } from 'preact';
import { renderHook, act, waitFor } from '@testing-library/preact';
import { useQuery, CacheContext } from './index.js';

const getUniqueKey = () => `example${++getUniqueKey.counter}`;
getUniqueKey.counter = 0;

describe('useQuery', () => {
	before(() => {
		GlobalRegistrator.register();
	});

	after(() => {
		GlobalRegistrator.unregister();
	});

	it('returns initial value', () => {
		const key = getUniqueKey();
		const fetcher = () => null;
		const { result } = renderHook(() => useQuery(key, fetcher));

		assert.strictEqual(result.current?.status, 'loading');
		assert.strictEqual(result.current?.isLoading, true);
		assert.strictEqual(result.current?.isSuccess, false);
		assert.strictEqual(result.current?.isError, false);
		assert.strictEqual(typeof result.current?.refetch, 'function');
		assert.strictEqual(typeof result.current?.setData, 'function');
	});

	it('renders with resolved value', async () => {
		const key = getUniqueKey();
		const { result } = renderHook(() => useQuery(key, () => null));

		await waitFor(() => assert.strictEqual(result.current?.status, 'success'));

		assert.strictEqual(result.current?.status, 'success');
		assert.strictEqual(result.current?.isLoading, false);
		assert.strictEqual(result.current?.isSuccess, true);
		assert.strictEqual(result.current?.isError, false);
		assert.strictEqual(result.current?.data, null);
		assert.strictEqual(typeof result.current?.refetch, 'function');
		assert.strictEqual(typeof result.current?.setData, 'function');
	});

	it('dedupes multiple queries of same key', async () => {
		const key = getUniqueKey();
		const fetcher = mock.fn(() => null);
		const { result: result1 } = renderHook(() => useQuery(key, fetcher));
		const { result: result2 } = renderHook(() => useQuery(key, fetcher));

		await Promise.all([
			waitFor(() => assert.strictEqual(result1.current?.data, null)),
			waitFor(() => assert.strictEqual(result2.current?.data, null)),
		]);

		assert.strictEqual(fetcher.mock.callCount(), 1);
	});

	it('refetches', async () => {
		const key = getUniqueKey();
		let value = 0;
		const { result } = renderHook(() => useQuery(key, () => ++value));

		await waitFor(() => assert.strictEqual(result.current?.data, 1));
		act(() => result.current?.refetch());
		await waitFor(() => assert.strictEqual(result.current?.data, 2));
	});

	it('maintains data during refetch', async () => {
		const key = getUniqueKey();
		let value = 0;
		const { result } = renderHook(() => useQuery(key, () => ++value));

		await waitFor(() => assert.strictEqual(result.current?.data, 1));

		act(() => result.current?.refetch());

		assert.strictEqual(result.current?.isLoading, true);
		assert.strictEqual(result.current?.data, 1);

		await waitFor(() => assert.strictEqual(result.current?.data, 2));
		assert.strictEqual(result.current?.isLoading, false);
	});

	it('refetches on key change', async () => {
		let callCount = 0;
		const key = getUniqueKey();
		let { result } = renderHook(
			/** @param {{queryKey?: string}} Props */
			({ queryKey = key } = {}) =>
				useQuery(queryKey, () => {
					callCount++;
					return queryKey;
				}),
		);

		await waitFor(() => assert.strictEqual(result.current?.data, key));

		const nextKey = getUniqueKey();
		// TODO: rerender({ queryKey: nextKey });
		({ result } = renderHook(
			/** @param {{queryKey?: string}} Props */
			({ queryKey = nextKey } = {}) =>
				useQuery(queryKey, () => {
					callCount++;
					return queryKey;
				}),
		));
		await waitFor(() => assert.strictEqual(result.current?.data, nextKey));

		assert.strictEqual(callCount, 2);
		assert.strictEqual(result.current?.status, 'success');
		assert.strictEqual(result.current?.isLoading, false);
		assert.strictEqual(result.current?.isSuccess, true);
		assert.strictEqual(result.current?.isError, false);
		assert.strictEqual(result.current?.data, nextKey);
		assert.strictEqual(typeof result.current?.refetch, 'function');
		assert.strictEqual(typeof result.current?.setData, 'function');
	});

	it('rerenders on refetch on all subscribed', async () => {
		const key = getUniqueKey();
		let value = 0;
		const fetcher = () => ++value;
		const { result: result1 } = renderHook(() => useQuery(key, fetcher));
		const { result: result2 } = renderHook(() => useQuery(key, fetcher));

		await Promise.all([
			waitFor(() => assert(result1.current?.isSuccess)),
			waitFor(() => assert(result2.current?.isSuccess)),
		]);

		act(() => result1.current?.refetch());

		await Promise.all([
			waitFor(() => assert.strictEqual(result1.current?.data, 2)),
			waitFor(() => assert.strictEqual(result2.current?.data, 2)),
		]);
	});

	it('removes subscriber on unmount', () => {
		const key = getUniqueKey();
		const cache = new Map();
		const { unmount } = renderHook(() => useQuery(key, () => null), {
			wrapper: ({ children }) => createElement(CacheContext.Provider, { value: cache, children }),
		});

		assert.strictEqual(cache.size, 1);
		unmount();
		assert.strictEqual(cache.size, 0);
	});

	it('renders with error', async () => {
		const key = getUniqueKey();
		const error = new Error();
		const { result } = renderHook(() =>
			useQuery(
				key,
				mock.fn(() => Promise.reject(error)),
			),
		);

		await waitFor(() => assert(result.current?.isError));

		assert.strictEqual(result.current?.status, 'error');
		assert.strictEqual(result.current?.isLoading, false);
		assert.strictEqual(result.current?.isSuccess, false);
		assert.strictEqual(result.current?.isError, true);
		assert.strictEqual(result.current?.error, error);
		assert.strictEqual(typeof result.current?.refetch, 'function');
		assert.strictEqual(typeof result.current?.setData, 'function');
	});

	it('renders with data on refetch after error', async () => {
		const key = getUniqueKey();
		const error = new Error();
		const fetcher = mock.fn(() => null);
		fetcher.mock.mockImplementationOnce(() => Promise.reject(error));

		const { result } = renderHook(() => useQuery(key, fetcher));

		await waitFor(() => assert(result.current?.isError));
		act(() => result.current?.refetch());

		await waitFor(() => assert(result.current?.isSuccess));

		assert.strictEqual(result.current?.status, 'success');
		assert.strictEqual(result.current?.isLoading, false);
		assert.strictEqual(result.current?.isSuccess, true);
		assert.strictEqual(result.current?.isError, false);
		assert.strictEqual(result.current?.error, undefined);
		assert.strictEqual(result.current?.data, null);
		assert.strictEqual(typeof result.current?.refetch, 'function');
		assert.strictEqual(typeof result.current?.setData, 'function');
	});

	it('renders with data on error after fetch', async () => {
		const key = getUniqueKey();
		const error = new Error();
		const fetcher = mock.fn(() => null);

		const { result } = renderHook(() => useQuery(key, fetcher));

		await waitFor(() => assert(result.current?.isSuccess));
		fetcher.mock.mockImplementationOnce(() => Promise.reject(error));
		act(() => result.current?.refetch());
		await waitFor(() => assert(result.current?.isError));

		assert.strictEqual(result.current?.status, 'error');
		assert.strictEqual(result.current?.isLoading, false);
		assert.strictEqual(result.current?.isSuccess, false);
		assert.strictEqual(result.current?.isError, true);
		assert.strictEqual(result.current?.error, error);
		assert.strictEqual(result.current?.data, null);
		assert.strictEqual(typeof result.current?.refetch, 'function');
		assert.strictEqual(typeof result.current?.setData, 'function');
	});

	it('sets data for all subscribers', async () => {
		const key = getUniqueKey();
		const fetcher = () => 1;
		const { result: result1 } = renderHook(() => useQuery(key, fetcher));
		const { result: result2 } = renderHook(() => useQuery(key, fetcher));

		await Promise.all([
			waitFor(() => assert(result1.current?.isSuccess)),
			waitFor(() => assert(result2.current?.isSuccess)),
		]);

		act(() => result1.current?.setData(2));

		await Promise.all([
			waitFor(() => assert.strictEqual(result1.current?.data, 2)),
			waitFor(() => assert.strictEqual(result2.current?.data, 2)),
		]);
	});

	it('has valid types for common properties', () => {
		// The test cases above are not able to test for this since assertions don't type-check
		// against the value under test.
		const key = getUniqueKey();
		const fetcher = () => null;
		const { result } = renderHook(() => useQuery(key, fetcher));

		result.current?.status;
		result.current?.data;
		result.current?.isLoading;
		result.current?.isSuccess;
		result.current?.isError;
		result.current?.error;
		result.current?.setData;
		result.current?.refetch;
	});

	it('supports conditional fetching by nullish key', async () => {
		const fetcher = mock.fn(() => null);
		const { result } = renderHook(() => useQuery(null, fetcher));

		await waitFor(() => assert.strictEqual(result.current?.isLoading, false));

		assert.strictEqual(fetcher.mock.callCount(), 0);
		assert.strictEqual(result.current?.status, undefined);
		assert.strictEqual(result.current?.isLoading, false);
		assert.strictEqual(result.current?.isSuccess, false);
		assert.strictEqual(result.current?.isError, false);
		assert.strictEqual(result.current?.error, undefined);
		assert.strictEqual(result.current?.data, undefined);
		assert.strictEqual(typeof result.current?.refetch, 'function');
		assert.strictEqual(typeof result.current?.setData, 'function');
	});
});
