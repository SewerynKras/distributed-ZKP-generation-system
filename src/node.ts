import * as grpc from "@grpc/grpc-js";
import { ProofService } from "./generated/grpc/proof_grpc_pb";
import {
	generateProofHandler,
	getHandleGetNodesList,
	getHandleJoinNetwork,
	getHandlePing,
} from "./communication/request-handler";
import type { KnownNodesState } from "./network/node-manager";
import { NetworkService } from "./generated/grpc/network_grpc_pb";
import type { NodeContext } from "./types";

const PORT = Number.parseInt(process.env.PORT || "50051");

const server = new grpc.Server();

const context: NodeContext = {
	nodeId: "TEST_NODE",
	host: "localhost",
	port: PORT,
	knownNodes: new Map() as KnownNodesState,
};

server.addService(ProofService, {
	generateProof: generateProofHandler,
});
server.addService(NetworkService, {
	getNodesList: getHandleGetNodesList(context),
	joinNetwork: getHandleJoinNetwork(context),
	ping: getHandlePing(context),
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
