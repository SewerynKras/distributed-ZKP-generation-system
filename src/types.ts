import type * as grpc from "@grpc/grpc-js";
import type { NetworkClient } from "./generated/grpc/network_grpc_pb";
import type { ProofClient } from "./generated/grpc/proof_grpc_pb";

/**
 * Node known by another node in the distributed network
 */
export type KnownNode = Readonly<{
	nodeId: string;
	host: string;
	port: number;
	missedPings: number;
	networkClient: NetworkClient;
	proofClient: ProofClient;
}>;
/**
 * Collection of nodes known by another node in the distributed network
 */
export type NodeState = ReadonlyMap<string, Readonly<KnownNode>>;

/**
 * Base context that every (consumer and computation) node needs
 */
export type CommonNodeContext = Readonly<{
	getCurrentNodeState: () => NodeState;
	updateNodeState: (newState: NodeState) => void;
}>;

/**
 * Context of a computation node in the distributed network.
 * This node can request other nodes to share their state and join the network.
 * It cannot request other nodes to perform computations.
 */
export type ComputationNodeContext = CommonNodeContext &
	Readonly<{
		nodeId: string;
		host: string;
		port: number;
	}>;
/**
 * Context of a client that wants to interact with the distributed network.
 * This node can only request other nodes to share their state and perform computations.
 * It cannot request other nodes to join the network.
 */
export type ConsumerNodeContext = CommonNodeContext;

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
	context: ComputationNodeContext,
) => Promise<HandlerResult<ResponseType>>;
