import * as grpc from "@grpc/grpc-js";
import type { KnownNode } from "../types";
import { NetworkClient } from "../generated/grpc/network_grpc_pb";
import {
	Empty,
	JoinRequest,
	type JoinResponse,
	type KnownNode as KnownNodeProto,
	type PongMessage,
} from "../generated/grpc/network_pb";
import { ProofClient } from "../generated/grpc/proof_grpc_pb";

export function createNetworkClient(host: string, port: number): NetworkClient {
	return new NetworkClient(
		`${host}:${port}`,
		grpc.credentials.createInsecure(),
	);
}

export function createProofClient(host: string, port: number): ProofClient {
	return new ProofClient(`${host}:${port}`, grpc.credentials.createInsecure());
}

export function destroyClient(client: grpc.Client): void {
	client.close();
}

const TIMEOUT_MS = 5000;

export function sendPing(receiverNode: KnownNode): Promise<PongMessage> {
	const { promise, resolve, reject } = Promise.withResolvers<PongMessage>();
	const client = receiverNode.networkClient;

	const deadline = new Date();
	deadline.setMilliseconds(deadline.getMilliseconds() + TIMEOUT_MS);
	client.ping(
		new Empty(),
		new grpc.Metadata(),
		{ deadline },
		(err, response) => {
			if (err) {
				reject(err);
				return;
			}
			resolve(response);
		},
	);
	return promise;
}

export function sendJoinRequest(
	senderNodeId: string,
	senderHost: string,
	senderPort: number,
	receiverNode: KnownNode,
): Promise<JoinResponse> {
	const { promise, resolve, reject } = Promise.withResolvers<JoinResponse>();
	const client = receiverNode.networkClient;
	const joinRequest = new JoinRequest();
	joinRequest.setNodeId(senderNodeId);
	joinRequest.setHost(senderHost);
	joinRequest.setPort(senderPort);

	const deadline = new Date();
	deadline.setMilliseconds(deadline.getMilliseconds() + TIMEOUT_MS);
	client.joinNetwork(
		joinRequest,
		new grpc.Metadata(),
		{ deadline },
		(err, response) => {
			if (err) {
				reject(err);
				return;
			}
			resolve(response);
		},
	);
	return promise;
}

export function sendGetNodesList(
	receiverNode: KnownNode,
): Promise<KnownNodeProto[]> {
	const { promise, resolve, reject } =
		Promise.withResolvers<KnownNodeProto[]>();
	const client = receiverNode.networkClient;
	const deadline = new Date();
	deadline.setMilliseconds(deadline.getMilliseconds() + TIMEOUT_MS);
	client.getNodesList(
		new Empty(),
		new grpc.Metadata(),
		{ deadline },
		(err, response) => {
			if (err) {
				reject(err);
				return;
			}
			resolve(response.getNodesList());
		},
	);
	return promise;
}
