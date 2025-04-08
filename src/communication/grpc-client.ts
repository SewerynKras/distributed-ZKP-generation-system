import * as grpc from "@grpc/grpc-js";
import type { KnownNode } from "../types";
import { NetworkClient } from "../generated/grpc/network_grpc_pb";
import {
	Empty,
	JoinRequest,
	type JoinResponse,
	type KnownNode as KnownNodeProto,
	PingMessage,
	type PongMessage,
} from "../generated/grpc/network_pb";

export function createClient(host: string, port: number): NetworkClient {
	return new NetworkClient(
		`${host}:${port}`,
		grpc.credentials.createInsecure(),
	);
}

export function destroyClient(client: grpc.Client): void {
	client.close();
}

export function sendPing(
	senderNodeId: string,
	receiverNode: KnownNode,
	timeoutMs: number,
): Promise<PongMessage> {
	const { promise, resolve, reject } = Promise.withResolvers<PongMessage>();
	const client = receiverNode.client;
	const pingMessage = new PingMessage();
	pingMessage.setNodeId(senderNodeId);

	const deadline = new Date();
	deadline.setMilliseconds(deadline.getMilliseconds() + timeoutMs);
	client.ping(
		pingMessage,
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
	const client = receiverNode.client;
	const joinRequest = new JoinRequest();
	joinRequest.setNodeId(senderNodeId);
	joinRequest.setHost(senderHost);
	joinRequest.setPort(senderPort);

	const deadline = new Date();
	deadline.setMilliseconds(deadline.getMilliseconds() + 5000);
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
	const client = receiverNode.client;
	const deadline = new Date();
	deadline.setMilliseconds(deadline.getMilliseconds() + 5000);
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
