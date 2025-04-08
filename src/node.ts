import * as grpc from "@grpc/grpc-js";
import { ProofService } from "./generated/grpc/proof_grpc_pb";
import {
	generateProofHandler,
	getHandleGetNodesList,
	getHandleJoinNetwork,
	getHandlePing,
} from "./communication/request-handler";
import {
	cleanupNodeResources,
	createNode,
	createNodeState,
} from "./network/node-manager";
import { NetworkService } from "./generated/grpc/network_grpc_pb";
import type { NodeContext, NodeState } from "./types";
import { createGrpcHandler } from "./communication/grpc-handler-wrapper";
import {
	startHealthMonitor,
	stopHealthMonitor,
} from "./network/health-monitor";
import { discoverOtherNodes } from "./network/node-discovery";

const PORT = Number.parseInt(Bun.env.PORT || "50051");
const NODE_ID = Bun.env.NODE_ID || "default-node-id";
const HOST = await (Bun.env.HOST ||
	fetch("https://icanhazip.com")
		.then((res) => res.text())
		.then((ip) => ip.trim()));

console.log(`Starting node ${NODE_ID} on ${HOST}:${PORT}`);
const server = new grpc.Server();

let initiallyKnownNodes = undefined;
if (Bun.env.KNOWN_NODES_PATH) {
	initiallyKnownNodes = (await Bun.file(Bun.env.KNOWN_NODES_PATH).json()) as {
		nodeId: string;
		host: string;
		port: number;
	}[];
	initiallyKnownNodes = initiallyKnownNodes.map((node) =>
		createNode(node.nodeId, node.host, node.port),
	);
	console.debug(
		`Loaded ${initiallyKnownNodes.length} nodes from ${Bun.env.KNOWN_NODES_PATH}`,
	);
}

let currentNodeState: NodeState = createNodeState(initiallyKnownNodes);
const getCurrentNodeState = (): NodeState => currentNodeState;
const updateNodeState = (newState: NodeState): void => {
	currentNodeState = newState;
};

const nodeContext: NodeContext = {
	nodeId: NODE_ID,
	host: HOST,
	port: PORT,
	getCurrentNodeState: getCurrentNodeState,
	updateNodeState: updateNodeState,
};

// Begin the discovery process
discoverOtherNodes(nodeContext);

server.addService(ProofService, {
	generateProof: createGrpcHandler(generateProofHandler, nodeContext),
});
server.addService(NetworkService, {
	getNodesList: createGrpcHandler(getHandleGetNodesList, nodeContext),
	joinNetwork: createGrpcHandler(getHandleJoinNetwork, nodeContext),
	ping: createGrpcHandler(getHandlePing, nodeContext),
});

const healthMonitor = startHealthMonitor(nodeContext);

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

process.on("SIGINT", () => {
	console.log("Received SIGINT, shutting down gracefully");
	stopHealthMonitor(healthMonitor);
	nodeContext.getCurrentNodeState().forEach(cleanupNodeResources);
	server.tryShutdown((error) => {
		if (error) {
			console.error("Error shutting down server:", error);
			process.exit(1);
		}
		console.log("Server shut down gracefully");
		process.exit(0);
	});
	setTimeout(() => {
		console.error("Graceful shutdown timed out, forcing exit.");
		server.forceShutdown();
		process.exit(1);
	}, 5000);
});
