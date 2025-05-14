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
	createInitialNodeState,
} from "./network/node-manager";
import { NetworkService } from "./generated/grpc/network_grpc_pb";
import type { ComputationNodeContext } from "./types";
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
const PING_INTERVAL_MS = 5000;
const UNANSWERED_PING_THRESHOLD = 3;
const BIND_ADDRESS = Bun.env.BIND_ADDRESS || "[::]";

console.log(`Starting node ${NODE_ID} on ${HOST}:${PORT}`);
const server = new grpc.Server();

const maybeInitiallyKnownNodes =
	!!Bun.env.KNOWN_NODES_PATH &&
	(await Bun.file(Bun.env.KNOWN_NODES_PATH).json());

const nodeStateProxy = createInitialNodeState(maybeInitiallyKnownNodes);
const nodeContext: ComputationNodeContext = {
	nodeId: NODE_ID,
	host: HOST,
	port: PORT,
	getCurrentNodeState: nodeStateProxy.get.bind(nodeStateProxy),
	updateNodeState: nodeStateProxy.set.bind(nodeStateProxy),
};

console.log("Starting node discovery process, this may take a while...");
const discoveredState = await discoverOtherNodes(nodeContext);
nodeStateProxy.set(discoveredState);
console.debug(
	`Finished node discovery, found ${nodeContext.getCurrentNodeState().size} nodes`,
);

server.addService(ProofService, {
	generateProof: createGrpcHandler(generateProofHandler, nodeContext),
});
server.addService(NetworkService, {
	getNodesList: createGrpcHandler(getHandleGetNodesList, nodeContext),
	joinNetwork: createGrpcHandler(getHandleJoinNetwork, nodeContext),
	ping: createGrpcHandler(getHandlePing, nodeContext),
});

const healthMonitor = startHealthMonitor(
	nodeContext,
	PING_INTERVAL_MS,
	UNANSWERED_PING_THRESHOLD,
);

server.bindAsync(
	`${BIND_ADDRESS}:${PORT}`,
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
