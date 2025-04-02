type NodeDetails = {
	nodeId: string;
	host: string;
	port: number;
};

export type KnownNodesState = ReadonlyMap<string, Readonly<NodeDetails>>;

export function addNode(
	currentState: KnownNodesState,
	nodeId: string,
	host: string,
	port: number,
): KnownNodesState {
	const nodeDetails = { nodeId, host, port };
	const newState = new Map(currentState);
	newState.set(nodeId, nodeDetails);
	return newState;
}

export function removeNode(
	currentState: KnownNodesState,
	nodeId: string,
): KnownNodesState {
	const newState = new Map(currentState);
	newState.delete(nodeId);
	return newState;
}

export function getKnownNodes(currentState: KnownNodesState): NodeDetails[] {
	return Array.from(currentState.values());
}
