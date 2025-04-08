import { describe, it, expect, mock, afterEach, afterAll } from "bun:test";
import type { KnownNode, NodeContext, NodeState } from "../src/types";
import type { NetworkClient } from "../src/generated/grpc/network_grpc_pb";
import {
	checkNodes,
	pingNode,
	startHealthMonitor,
} from "../src/network/health-monitor";
import { createNodeState } from "../src/network/node-manager";
import { mockModule } from "./utils";

const mockSendPing = mock();
const clearClientMock = await mockModule(
	"../src/communication/grpc-client.ts",
	() => ({
		sendPing: mockSendPing,
	}),
);

const getMockNode = (nodeId: string, missedPings = 0): KnownNode => ({
	nodeId,
	host: "localhost",
	port: 8080,
	missedPings,
	client: {} as NetworkClient,
});

afterAll(() => {
	clearClientMock();
});

describe("health-monitor", () => {
	afterEach(() => {
		mockSendPing.mockReset();
	});

	describe("pingNode", () => {
		it("should return node with missedPings incremented by 1 if ping was unsuccessful", async () => {
			const senderNodeId = "senderNodeId";
			const targetNode = getMockNode("targetNodeId");
			mockSendPing.mockImplementationOnce(() => {
				throw new Error("Ping failed");
			});
			const result = await pingNode(senderNodeId, targetNode);
			expect(result.missedPings).toBe(1);
		});
		it("should reset missedPings to 0 if ping was successful", async () => {
			const senderNodeId = "senderNodeId";
			const targetNode = getMockNode("targetNodeId", 2);
			mockSendPing.mockImplementationOnce(() => {});
			const result = await pingNode(senderNodeId, targetNode);
			expect(result.missedPings).toBe(0);
		});
	});
	describe("checkNodes", () => {
		it("should call pingNode for each node", async () => {
			const senderNodeId = "senderNodeId";
			const targetNode1 = getMockNode("targetNode1");
			const targetNode2 = getMockNode("targetNode2");
			const targetNode3 = getMockNode("targetNode3");
			const nodes = [targetNode1, targetNode2, targetNode3];
			await checkNodes(senderNodeId, nodes);
			expect(mockSendPing).toHaveBeenCalledTimes(3);
			expect(mockSendPing).toHaveBeenCalledWith(senderNodeId, targetNode1);
			expect(mockSendPing).toHaveBeenCalledWith(senderNodeId, targetNode2);
			expect(mockSendPing).toHaveBeenCalledWith(senderNodeId, targetNode3);
		});

		it("should put nodes with enough missedPings to the nodesToRemove array", async () => {
			const senderNodeId = "senderNodeId";
			const targetNode1 = getMockNode("targetNode1", 0);
			const targetNode2 = getMockNode("targetNode2", 2);
			const targetNode3 = getMockNode("targetNode3", 0);
			const nodes = [targetNode1, targetNode2, targetNode3];
			mockSendPing.mockImplementation(() => {
				throw new Error("Ping failed");
			});
			const { nodesToKeep, nodesToRemove } = await checkNodes(
				senderNodeId,
				nodes,
				3,
			);
			expect(nodesToKeep.length).toBe(2);
			expect(nodesToRemove.length).toBe(1);
			expect(nodesToKeep[0]?.nodeId).toBe("targetNode1");
			expect(nodesToKeep[0]?.missedPings).toBe(1);
			expect(nodesToKeep[1]?.nodeId).toBe("targetNode3");
			expect(nodesToKeep[1]?.missedPings).toBe(1);
			expect(nodesToRemove[0]?.nodeId).toBe("targetNode2");
			expect(nodesToRemove[0]?.missedPings).toBe(3);
		});
	});
	describe("startHealthMonitor", () => {
		// Capture what was passed to the global setInterval function
		const globalSetInterval = global.setInterval;
		const setIntervalMock = mock();
		global.setInterval = (callback: () => void, timeout?: number) => {
			setIntervalMock(callback, timeout);
			return globalSetInterval(callback, timeout);
		};
		afterEach(() => {
			setIntervalMock.mockReset();
		});
		afterAll(() => {
			global.setInterval = globalSetInterval;
		});

		it("should check all nodes every interval", async () => {
			const node0 = getMockNode("node0");
			const node1 = getMockNode("node1");
			const nodeState = createNodeState([node0, node1]);
			const context: NodeContext = {
				nodeId: "nodeId",
				host: "host",
				port: 8080,
				getCurrentNodeState: mock(() => nodeState),
				updateNodeState: mock(),
			};
			startHealthMonitor(context, 5000);
			expect(setIntervalMock).toHaveBeenCalledWith(expect.any(Function), 5000);
			const [callback] = setIntervalMock.mock.calls[0] as [() => Promise<void>];
			await callback();
			expect(mockSendPing).toHaveBeenCalledWith("nodeId", node0);
			expect(mockSendPing).toHaveBeenCalledWith("nodeId", node1);
			expect(mockSendPing).toHaveBeenCalledTimes(2);
		});
		it("update state only with nodes that should be kept", async () => {
			const node0 = getMockNode("node0");
			const node1 = getMockNode("node1", 2);
			const node2 = getMockNode("node1");
			const nodeState = createNodeState([node0, node1, node2]);
			const mockUpdateNodeState = mock();
			const context: NodeContext = {
				nodeId: "nodeId",
				host: "host",
				port: 8080,
				getCurrentNodeState: mock(() => nodeState),
				updateNodeState: mockUpdateNodeState,
			};
			startHealthMonitor(context, 5000);
			expect(setIntervalMock).toHaveBeenCalledWith(expect.any(Function), 5000);
			const [callback] = setIntervalMock.mock.calls[0] as [() => Promise<void>];
			await callback();
			expect(context.updateNodeState).toHaveBeenCalledTimes(1);
			const [updatedState] = mockUpdateNodeState.mock.calls[0] as [NodeState];
			expect(updatedState.get("node0")).toBeDefined();
			expect(updatedState.get("node1")).toBeDefined();
			expect(updatedState.get("node2")).toBeUndefined();
		});
	});
});
