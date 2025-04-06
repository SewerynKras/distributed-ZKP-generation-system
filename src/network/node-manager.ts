import { createClient, destroyClient } from "../communication/grpc-client";
import type { KnownNode, NodeState } from "../types";

export function createNode(
	nodeId: string,
	host: string,
	port: number,
): KnownNode {
	return Object.freeze({
		nodeId,
		host,
		port,
		missedPings: 0,
		client: createClient(host, port),
	});
}

export function addNode(
	currentState: NodeState,
	nodeId: string,
	host: string,
	port: number,
): NodeState {
	const nodeDetails = createNode(nodeId, host, port);
	const newState = new Map(currentState);
	newState.set(nodeId, nodeDetails);
	return newState;
}

export function cleanupNodeResources(node: KnownNode): void {
	destroyClient(node.client);
}

export function getKnownNodes(currentState: NodeState): KnownNode[] {
	return Array.from(currentState.values());
}

export function createNodeState(nodes?: KnownNode[]): NodeState {
	if (nodes) {
		return new Map(nodes.map((node) => [node.nodeId, node]));
	}
	return new Map();
}
