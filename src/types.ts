import type { KnownNodesState } from "./network/node-manager";

export type NodeContext = {
	nodeId: string;
	host: string;
	port: number;
	knownNodes: KnownNodesState;
};
