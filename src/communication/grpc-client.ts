import * as grpc from "@grpc/grpc-js";
import type { KnownNode } from "../types";
import { NetworkClient } from "../generated/grpc/network_grpc_pb";
import { PingMessage, type PongMessage } from "../generated/grpc/network_pb";

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
