import * as grpc from "@grpc/grpc-js";
import { ProofService } from "./generated/grpc/proof_grpc_pb";
import {
	generateProofHandler,
	getHandleGetNodesList,
	getHandleJoinNetwork,
	getHandlePing,
} from "./communication/request-handler";
import { createInitialNodeState } from "./network/node-manager";
import { NetworkService } from "./generated/grpc/network_grpc_pb";
import type { NodeContext, NodeState } from "./types";
import { createGrpcHandler } from "./communication/grpc-handler-wrapper";

const PORT = Number.parseInt(process.env.PORT || "50051");

const server = new grpc.Server();

let currentNodeState: NodeState = createInitialNodeState();
const getCurrentNodeState = (): NodeState => currentNodeState;
const updateNodeState = (newState: NodeState): void => {
	currentNodeState = newState;
};

const nodeContext: NodeContext = {
	nodeId: "default-node-id",
	getCurrentNodeState: getCurrentNodeState,
	updateNodeState: updateNodeState,
};

server.addService(ProofService, {
	generateProof: createGrpcHandler(generateProofHandler, nodeContext),
});
server.addService(NetworkService, {
	getNodesList: createGrpcHandler(getHandleGetNodesList, nodeContext),
	joinNetwork: createGrpcHandler(getHandleJoinNetwork, nodeContext),
	ping: createGrpcHandler(getHandlePing, nodeContext),
});

server.bindAsync(
	`0.0.0.0:${PORT}`,
	grpc.ServerCredentials.createInsecure(),
	(err, port) => {
		if (err) {
			console.error("Failed to bind server:", err);
			process.exit(1);
		}
		console.log(`🚀 gRPC Server running on port ${port}`);
	},
);
