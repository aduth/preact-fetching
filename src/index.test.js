import { createElement } from 'preact';
import { renderHook, act } from '@testing-library/preact-hooks';
import { useQuery, CacheContext } from '.';

const getUniqueKey = () => `example${++getUniqueKey.counter}`;
getUniqueKey.counter = 0;

describe('useQuery', () => {
	it('returns initial value', () => {
		const key = getUniqueKey();
		const fetcher = () => null;
		const { result } = renderHook(() => useQuery(key, fetcher));

		expect(result.current).toEqual({
			status: 'loading',
			isLoading: true,
			isSuccess: false,
			isError: false,
			refetch: expect.any(Function),
			setData: expect.any(Function),
		});
	});

	it('renders with resolved value', async () => {
		const key = getUniqueKey();
		const { result, waitFor } = renderHook(() => useQuery(key, () => null));

		await waitFor(() => expect(result.current?.status).toBe('success'));

		expect(result.current).toEqual({
			status: 'success',
			isLoading: false,
			isSuccess: true,
			isError: false,
			data: null,
			refetch: expect.any(Function),
			setData: expect.any(Function),
		});
	});

	it('dedupes multiple queries of same key', async () => {
		const key = getUniqueKey();
		const fetcher = jest.fn().mockReturnValue(null);
		const { result: result1, waitFor: waitFor1 } = renderHook(() => useQuery(key, fetcher));
		const { result: result2, waitFor: waitFor2 } = renderHook(() => useQuery(key, fetcher));

		await Promise.all([
			waitFor1(() => expect(result1.current?.data).toBe(null)),
			waitFor2(() => expect(result2.current?.data).toBe(null)),
		]);

		expect(fetcher).toBeCalledTimes(1);
	});

	it('refetches', async () => {
		const key = getUniqueKey();
		let value = 0;
		const { result, waitFor } = renderHook(() => useQuery(key, () => ++value));

		await waitFor(() => expect(result.current?.data).toBe(1));
		act(() => result.current?.refetch());
		await waitFor(() => expect(result.current?.data).toBe(2));
	});

	it('maintains data during refetch', async () => {
		const key = getUniqueKey();
		let value = 0;
		const { result, waitFor } = renderHook(() => useQuery(key, () => ++value));

		await waitFor(() => expect(result.current?.data).toBe(1));

		act(() => result.current?.refetch());

		expect(result.current?.isLoading).toBe(true);
		expect(result.current?.data).toBe(1);

		await waitFor(() => expect(result.current?.data).toBe(2));
		expect(result.current?.isLoading).toBe(false);
	});

	it('refetches on key change', async () => {
		let callCount = 0;
		const key = getUniqueKey();
		let { result, waitFor } = renderHook(
			/** @param {{queryKey?: string}} Props */
			({ queryKey = key } = {}) =>
				useQuery(queryKey, () => {
					callCount++;
					return queryKey;
				})
		);

		await waitFor(() => expect(result.current?.data).toBe(key));

		const nextKey = getUniqueKey();
		// TODO: rerender({ queryKey: nextKey });
		({ result, waitFor } = renderHook(
			/** @param {{queryKey?: string}} Props */
			({ queryKey = nextKey } = {}) =>
				useQuery(queryKey, () => {
					callCount++;
					return queryKey;
				})
		));
		await waitFor(() => expect(result.current?.data).toBe(nextKey));

		expect(callCount).toBe(2);

		expect(result.current).toEqual({
			status: 'success',
			isLoading: false,
			isSuccess: true,
			isError: false,
			data: nextKey,
			refetch: expect.any(Function),
			setData: expect.any(Function),
		});
	});

	it('rerenders on refetch on all subscribed', async () => {
		const key = getUniqueKey();
		let value = 0;
		const fetcher = () => ++value;
		const { result: result1, waitFor: waitFor1 } = renderHook(() => useQuery(key, fetcher));
		const { result: result2, waitFor: waitFor2 } = renderHook(() => useQuery(key, fetcher));

		await Promise.all([
			waitFor1(() => result1.current?.isSuccess),
			waitFor2(() => result2.current?.isSuccess),
		]);

		act(() => result1.current?.refetch());

		await Promise.all([
			waitFor1(() => expect(result1.current?.data).toBe(2)),
			waitFor2(() => expect(result2.current?.data).toBe(2)),
		]);
	});

	it('removes subscriber on unmount', () => {
		const key = getUniqueKey();
		const cache = new Map();
		const { unmount } = renderHook(() => useQuery(key, () => null), {
			wrapper: ({ children }) => createElement(CacheContext.Provider, { value: cache, children }),
		});

		expect(cache.size).toBe(1);
		unmount();
		expect(cache.size).toBe(0);
	});

	it('renders with error', async () => {
		const key = getUniqueKey();
		const error = new Error();
		const { result, waitFor } = renderHook(() => useQuery(key, jest.fn().mockRejectedValue(error)));

		await waitFor(() => result.current?.isError);

		expect(result.current).toEqual({
			status: 'error',
			isLoading: false,
			isSuccess: false,
			isError: true,
			error,
			refetch: expect.any(Function),
			setData: expect.any(Function),
		});
	});

	it('renders with data on refetch after error', async () => {
		const key = getUniqueKey();
		const error = new Error();

		const { result, waitFor } = renderHook(() =>
			useQuery(key, jest.fn().mockRejectedValueOnce(error).mockReturnValue(null))
		);

		await waitFor(() => result.current?.isError);
		act(() => result.current?.refetch());

		expect(result.current).toEqual({
			status: 'loading',
			isLoading: true,
			isSuccess: false,
			isError: false,
			refetch: expect.any(Function),
			setData: expect.any(Function),
		});

		await waitFor(() => result.current?.isSuccess);

		expect(result.current).toEqual({
			status: 'success',
			isLoading: false,
			isSuccess: true,
			isError: false,
			data: null,
			refetch: expect.any(Function),
			setData: expect.any(Function),
		});
	});

	it('renders with data on error after fetch', async () => {
		const key = getUniqueKey();
		const error = new Error();

		const { result, waitFor } = renderHook(() =>
			useQuery(key, jest.fn().mockReturnValueOnce(null).mockRejectedValue(error))
		);

		await waitFor(() => result.current?.isSuccess);
		act(() => result.current?.refetch());
		await waitFor(() => result.current?.isError);

		expect(result.current).toEqual({
			status: 'error',
			isLoading: false,
			isSuccess: false,
			isError: true,
			data: null,
			error,
			refetch: expect.any(Function),
			setData: expect.any(Function),
		});
	});

	it('sets data for all subscribers', async () => {
		const key = getUniqueKey();
		const fetcher = () => 1;
		const { result: result1, waitFor: waitFor1 } = renderHook(() => useQuery(key, fetcher));
		const { result: result2, waitFor: waitFor2 } = renderHook(() => useQuery(key, fetcher));

		await Promise.all([
			waitFor1(() => result1.current?.isSuccess),
			waitFor2(() => result2.current?.isSuccess),
		]);

		act(() => result1.current?.setData(2));

		await Promise.all([
			waitFor1(() => expect(result1.current?.data).toBe(2)),
			waitFor2(() => expect(result2.current?.data).toBe(2)),
		]);
	});
});
