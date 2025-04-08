import { mock } from "bun:test";
// Bun test runner does not support restoring module mocks,
// so this simple helper is needed to mock modules
export const mockModule = async (
	modulePath: string,
	renderMocks: () => Record<string, unknown>,
) => {
	const original = {
		...(await import(modulePath)),
	};
	const mocks = renderMocks();
	const result = {
		...original,
		...mocks,
	};
	mock.module(modulePath, () => result);
	return () => {
		mock.module(modulePath, () => original);
	};
};
