import type * as grpc from "@grpc/grpc-js";
import type { NetworkClient } from "./generated/grpc/network_grpc_pb";

export type KnownNode = Readonly<{
	nodeId: string;
	host: string;
	port: number;
	missedPings: number;
	client: NetworkClient;
}>;
export type NodeState = ReadonlyMap<string, Readonly<KnownNode>>;
export type NodeContext = Readonly<{
	nodeId: string;
	host: string;
	port: number;
	getCurrentNodeState: () => NodeState;
	updateNodeState: (newState: NodeState) => void;
}>;

export type HandlerResult<ResponseType> =
	| {
			type: "success";
			response: ResponseType;
			nextState?: NodeState;
	  }
	| {
			type: "error";
			error: Partial<grpc.StatusObject>;
	  };

export type RequestHandler<RequestType, ResponseType> = (
	request: RequestType,
	context: NodeContext,
) => Promise<HandlerResult<ResponseType>>;
