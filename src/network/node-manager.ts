import {
	createNetworkClient,
	createProofClient,
	destroyClient,
} from "../communication/grpc-client";
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
		networkClient: createNetworkClient(host, port),
		proofClient: createProofClient(host, port),
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
	destroyClient(node.networkClient);
	destroyClient(node.proofClient);
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

export function parseInitialNodeState(
	unparsedNodes: unknown,
): unparsedNodes is {
	nodeId: string;
	host: string;
	port: number;
}[] {
	return (
		Array.isArray(unparsedNodes) &&
		unparsedNodes.every(
			(node) =>
				typeof node === "object" &&
				node !== null &&
				"nodeId" in node &&
				typeof node.nodeId === "string" &&
				"host" in node &&
				typeof node.host === "string" &&
				"port" in node &&
				typeof node.port === "number",
		)
	);
}

/**
 * Create the initial node state. If `unparsedNodes` is provided, it will be parsed and used as the initial state.
 * Otherwise, an empty state will be created.
 * Returns a proxy object that allows you to get and set the current state.
 */
export function createInitialNodeState(unparsedNodes?: unknown) {
	if (!unparsedNodes) {
		return {
			_state: createNodeState(),
			get() {
				return this._state;
			},
			set(newState: NodeState) {
				this._state = newState;
			},
		};
	}
	if (!parseInitialNodeState(unparsedNodes)) {
		throw new Error(
			"Invalid initial node state, make sure the file is a valid JSON array of objects with nodeId, host and port properties",
		);
	}
	return {
		_state: createNodeState(
			unparsedNodes.map((node) =>
				createNode(node.nodeId, node.host, node.port),
			),
		),
		get() {
			return this._state;
		},
		set(newState: NodeState) {
			this._state = newState;
		},
	};
}
