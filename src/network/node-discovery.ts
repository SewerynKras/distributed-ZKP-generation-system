import {
	sendGetNodesList,
	sendJoinRequest,
} from "../communication/grpc-client";
import type {
	ComputationNodeContext,
	CommonNodeContext,
	KnownNode,
	NodeState,
} from "../types";
import { getErrorMessage } from "../utils";
import { addNodes, createNode, removeNodes } from "./node-manager";

function isComputationNodeContext(
	context: CommonNodeContext,
): context is ComputationNodeContext {
	return "nodeId" in context && "host" in context && "port" in context;
}

/**
 * Recursively discovers other nodes in the network. If given a computation node context, it will
 * also first try to join the other node's list of known nodes.
 */
export async function discoverOtherNodes(
	context: CommonNodeContext,
): Promise<NodeState> {
	// what nodes are left to process
	const nodeQueue: KnownNode[] = [];
	// what nodes have been processed (successfully or not)
	const seenNodes: Set<string> = new Set();
	// what nodes have successfully passed the discovery phase
	const discoveredNodes: KnownNode[] = [];
	// what nodes have failed to respond
	const failedNodes: KnownNode[] = [];

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
		try {
			if (isComputationNodeContext(context)) {
				// Announce ourselves to the node
				await sendJoinRequest(context.nodeId, context.host, context.port, node);
			}
			// Then, ask for the list of nodes
			const nodesList = await sendGetNodesList(node);
			for (const newNode of nodesList) {
				if (
					isComputationNodeContext(context) &&
					newNode.getNodeId() === context.nodeId
				) {
					continue;
				}
				if (seenNodes.has(newNode.getNodeId())) {
					continue;
				}
				nodeQueue.push(
					createNode(newNode.getNodeId(), newNode.getHost(), newNode.getPort()),
				);
				seenNodes.add(newNode.getNodeId());
			}
			discoveredNodes.push(node);
		} catch (error) {
			console.warn(
				`Error discovering nodes from ${node.nodeId}: ${getErrorMessage(error)}`,
			);
			failedNodes.push(node);
		}
	}
	const currentNodeState = context.getCurrentNodeState();
	// combine previously known nodes with newly discovered ones
	// and remove failed nodes (which could have been previously known or not)
	return removeNodes(
		addNodes(currentNodeState, discoveredNodes),
		failedNodes.map((node) => node.nodeId),
	);
}
