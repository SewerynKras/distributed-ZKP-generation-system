import * as grpc from "@grpc/grpc-js";
import type { HandlerResult, NodeContext, RequestHandler } from "../types";
import { getErrorMessage } from "../utils";

export function createGrpcHandler<RequestProto, ResponseProto>(
	handler: RequestHandler<RequestProto, ResponseProto>,
	context: NodeContext,
): grpc.handleUnaryCall<RequestProto, ResponseProto> {
	return async (
		call: grpc.ServerUnaryCall<RequestProto, ResponseProto>,
		callback: grpc.sendUnaryData<ResponseProto>,
	): Promise<void> => {
		try {
			const result: HandlerResult<ResponseProto> = await handler(
				call.request,
				context,
			);
			if (result.type === "success") {
				if (result.nextState) {
					context.updateNodeState(result.nextState);
				}
				callback(null, result.response);
			} else {
				console.error(
					`gRPC Handler Error: ${getErrorMessage(result.error)}`,
					result.error.details,
				);
				callback(result.error);
			}
		} catch (error: unknown) {
			console.error("Unhandled error in gRPC handler logic:", error);
			const errorMessage = Error.isError(error) ? error.message : String(error);
			callback({
				code: grpc.status.INTERNAL,
				message: `Internal server error: ${errorMessage}`,
			});
		}
	};
}
