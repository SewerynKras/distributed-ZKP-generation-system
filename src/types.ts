import type * as grpc from "@grpc/grpc-js";

export type KnownNode = Readonly<{
	nodeId: string;
	host: string;
	port: number;
	status: "active" | "inactive" | "unknown";
	lastSeen: number;
}>;
export type NodeState = ReadonlyMap<string, Readonly<KnownNode>>;
export type NodeContext = Readonly<{
	nodeId: string;
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
