import type { KnownNode, NodeState } from "../types";

export function addNode(
	currentState: NodeState,
	nodeId: string,
	host: string,
	port: number,
): NodeState {
	const nodeDetails = Object.freeze({
		nodeId,
		host,
		port,
		status: "active",
		lastSeen: Date.now(),
	});
	const newState = new Map(currentState);
	newState.set(nodeId, nodeDetails);
	return newState;
}

export function removeNode(currentState: NodeState, nodeId: string): NodeState {
	const newState = new Map(currentState);
	newState.delete(nodeId);
	return newState;
}

export function getKnownNodes(currentState: NodeState): KnownNode[] {
	return Array.from(currentState.values());
}

export function createInitialNodeState(): NodeState {
	return new Map() as NodeState;
}
