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
	if (currentState.has(nodeId)) {
		return currentState;
	}
	const nodeDetails = createNode(nodeId, host, port);
	const newState = new Map(currentState);
	newState.set(nodeId, nodeDetails);
	return newState;
}

export function addNodes(
	currentState: NodeState,
	nodes: KnownNode[],
): NodeState {
	const newState = new Map(currentState);
	for (const node of nodes) {
		if (newState.has(node.nodeId)) {
			continue;
		}
		newState.set(node.nodeId, node);
	}
	return newState;
}

export function removeNode(currentState: NodeState, nodeId: string): NodeState {
	const nodeToRemove = currentState.get(nodeId);
	if (!nodeToRemove) {
		return currentState;
	}
	cleanupNodeResources(nodeToRemove);
	const newState = new Map(currentState);
	newState.delete(nodeId);
	return newState;
}

export function removeNodes(
	currentState: NodeState,
	nodeIds: string[],
): NodeState {
	const nextState = new Map(currentState);
	for (const nodeId of nodeIds) {
		const nodeToRemove = nextState.get(nodeId);
		if (!nodeToRemove) {
			continue;
		}
		cleanupNodeResources(nodeToRemove);
		nextState.delete(nodeId);
	}
	return nextState;
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
