import {
	sendGetNodesList,
	sendJoinRequest,
} from "../communication/grpc-client";
import type { KnownNode, NodeContext } from "../types";
import { getErrorMessage } from "../utils";
import { addNodes, cleanupNodeResources, createNode } from "./node-manager";

export async function discoverOtherNodes(context: NodeContext) {
	console.debug("Starting node discovery");
	// what nodes are left to process
	const nodeQueue: KnownNode[] = [];
	// what nodes have been processed (successfully or not)
	const seenNodes: Set<string> = new Set();
	// what nodes have successfully passed the discovery phase
	const discoveredNodes: KnownNode[] = [];

	const initiallyKnownNodes = context.getCurrentNodeState();
	for (const knownNode of initiallyKnownNodes.values()) {
		nodeQueue.push(knownNode);
		seenNodes.add(knownNode.nodeId);
	}

	while (nodeQueue.length > 0) {
		const node = nodeQueue.shift();
		if (!node) {
			continue;
		}
		seenNodes.add(node.nodeId);
		try {
			// First, announce ourselves to the node
			await sendJoinRequest(context.nodeId, context.host, context.port, node);
			// Then, ask for the list of nodes
			const nodesList = await sendGetNodesList(node);
			for (const newNode of nodesList) {
				if (newNode.getNodeId() === context.nodeId) {
					continue;
				}
				if (seenNodes.has(newNode.getNodeId())) {
					continue;
				}
				nodeQueue.push(
					createNode(newNode.getNodeId(), newNode.getHost(), newNode.getPort()),
				);
			}
			discoveredNodes.push(node);
		} catch (error) {
			console.warn(
				`Error discovering nodes from ${node.nodeId}: ${getErrorMessage(error)}`,
			);
			cleanupNodeResources(node);
		}
	}
	console.debug(
		`Finished node discovery, found ${discoveredNodes.length} nodes`,
	);
	const currentNodeState = context.getCurrentNodeState();
	return addNodes(currentNodeState, discoveredNodes);
}
