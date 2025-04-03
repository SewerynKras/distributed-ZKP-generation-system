export function getErrorMessage(error: unknown): string {
	if (Error.isError(error)) {
		return error.message;
	}
	return String(error);
}
