import { sendPing } from "../communication/grpc-client";
import type { KnownNode, NodeContext } from "../types";
import { getErrorMessage } from "../utils";
import {
	cleanupNodeResources,
	createNodeState,
	getKnownNodes,
} from "./node-manager";

const PING_INTERVAL_MS = 5000;
const UNANSWERED_PING_THRESHOLD = 3;

async function pingNode(
	senderNodeId: string,
	targetNode: KnownNode,
): Promise<KnownNode> {
	try {
		await sendPing(senderNodeId, targetNode, PING_INTERVAL_MS / 2);
		// If ping was successful -> set node as active
		console.debug(`Node ${targetNode.nodeId} responded to ping`);
		return Object.assign({}, targetNode, {
			missedPings: 0,
		});
	} catch (error) {
		console.warn(
			`Error pinging node ${targetNode.nodeId}: ${getErrorMessage(error)}`,
		);
		// If ping failed -> set node as inactive
		return Object.assign({}, targetNode, {
			missedPings: targetNode.missedPings + 1,
		});
	}
}

async function checkNodes(senderNodeId: string, nodes: KnownNode[]) {
	const updatedNodes = await Promise.all(
		nodes.map((node) => pingNode(senderNodeId, node)),
	);
	const nodesToKeep = [];
	const nodesToRemove = [];
	for (const node of updatedNodes) {
		if (node.missedPings < UNANSWERED_PING_THRESHOLD) {
			nodesToKeep.push(node);
		} else {
			console.debug(
				`Node ${node.nodeId} is inactive and will be removed from the list`,
			);
			nodesToRemove.push(node);
		}
	}
	return { nodesToKeep, nodesToRemove };
}

export function startHealthMonitor(context: NodeContext): NodeJS.Timeout {
	console.debug("Starting health monitor");
	return setInterval(async () => {
		let currentNodeState = context.getCurrentNodeState();
		const { nodesToKeep, nodesToRemove } = await checkNodes(
			context.nodeId,
			getKnownNodes(currentNodeState),
		);
		// node state may have changed in the meantime
		currentNodeState = context.getCurrentNodeState();
		nodesToRemove.forEach(cleanupNodeResources);
		context.updateNodeState(createNodeState(nodesToKeep));
	}, PING_INTERVAL_MS);
}

export function stopHealthMonitor(timeout: NodeJS.Timeout): void {
	clearInterval(timeout);
}
