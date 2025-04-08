import { describe, it, expect, mock, afterAll, afterEach } from "bun:test";
import type { NetworkClient } from "../src/generated/grpc/network_grpc_pb";
import type { KnownNode } from "../src/types";
import { discoverOtherNodes } from "../src/network/node-discovery";
import { createNodeState } from "../src/network/node-manager";
import { mockModule } from "./utils";
import { removeNodes as realRemoveNodes } from "../src/network/node-manager";

function getMockNode(nodeId: string): KnownNode {
	return {
		nodeId,
		host: "localhost",
		port: 8080,
		missedPings: 0,
		client: {} as NetworkClient,
	};
}

const node0 = getMockNode("node0");
const node1 = getMockNode("node1");
const node2 = getMockNode("node2");
const node3 = getMockNode("node3");

const knownNeighbors = {
	[node0.nodeId]: [node1, node2],
	[node1.nodeId]: [node0, node2, node3],
	[node2.nodeId]: [node0, node1, node3],
	[node3.nodeId]: [node2],
};

const mockSendJoinRequest = mock();
const mockSendGetNodesList = mock((node: KnownNode) => {
	return knownNeighbors[node.nodeId]?.map((node) => ({
		getNodeId: () => node.nodeId,
		getHost: () => node.host,
		getPort: () => node.port,
		_DEBUG: node.nodeId,
	}));
});
const clearClientMock = await mockModule(
	"../src/communication/grpc-client.ts",
	() => ({
		sendJoinRequest: mockSendJoinRequest,
		sendGetNodesList: mockSendGetNodesList,
	}),
);
const mockRemoveNodes = mock(realRemoveNodes);
const clearManagerMock = await mockModule(
	"../src/network/node-manager.ts",
	() => ({
		removeNodes: mockRemoveNodes,
	}),
);

afterAll(() => {
	clearManagerMock();
	clearClientMock();
});

describe("node-discovery", () => {
	afterEach(() => {
		mockSendJoinRequest.mockClear();
		mockSendGetNodesList.mockClear();
		mockRemoveNodes.mockClear();
	});

	it("should discover all nodes", async () => {
		const context = {
			nodeId: "root-node",
			host: "localhost",
			port: 8080,
			getCurrentNodeState: () => createNodeState([node0]),
			updateNodeState: mock(),
		};
		const updatedState = await discoverOtherNodes(context);
		expect(mockSendJoinRequest).toHaveBeenCalledTimes(4);
		expect(mockSendJoinRequest).toHaveBeenCalledWith(
			"root-node",
			"localhost",
			8080,
			expect.objectContaining({
				nodeId: "node0",
			}),
		);
		expect(mockSendJoinRequest).toHaveBeenCalledWith(
			"root-node",
			"localhost",
			8080,
			expect.objectContaining({
				nodeId: "node1",
			}),
		);
		expect(mockSendJoinRequest).toHaveBeenCalledWith(
			"root-node",
			"localhost",
			8080,
			expect.objectContaining({
				nodeId: "node2",
			}),
		);
		expect(mockSendJoinRequest).toHaveBeenCalledWith(
			"root-node",
			"localhost",
			8080,
			expect.objectContaining({
				nodeId: "node3",
			}),
		);
		expect(mockSendGetNodesList).toHaveBeenCalledTimes(4);
		expect(mockSendGetNodesList).toHaveBeenCalledWith(
			expect.objectContaining({
				nodeId: "node0",
			}),
		);
		expect(mockSendGetNodesList).toHaveBeenCalledWith(
			expect.objectContaining({
				nodeId: "node1",
			}),
		);
		expect(mockSendGetNodesList).toHaveBeenCalledWith(
			expect.objectContaining({
				nodeId: "node2",
			}),
		);
		expect(mockSendGetNodesList).toHaveBeenCalledWith(
			expect.objectContaining({
				nodeId: "node3",
			}),
		);
		expect(updatedState.get("node0")).toBeDefined();
		expect(updatedState.get("node1")).toBeDefined();
		expect(updatedState.get("node2")).toBeDefined();
		expect(updatedState.get("node3")).toBeDefined();
		expect(updatedState.size).toBe(4);
	});
	it("should discard and cleanup nodes that failed to respond", async () => {
		const context = {
			nodeId: "root-node",
			host: "localhost",
			port: 8080,
			getCurrentNodeState: () => createNodeState([node0]),
			updateNodeState: mock(),
		};
		mockSendJoinRequest
			.mockImplementation(() => {
				throw new Error("Join request failed");
			})
			.mockImplementationOnce(() => {});
		const updatedState = await discoverOtherNodes(context);
		// first it asked node0 which succeeded and returned node1 and node2
		// then both calls failed
		expect(mockSendJoinRequest).toHaveBeenCalledTimes(3);
		// the first call to node0 succeeded, so it will be asked for the list
		expect(mockSendGetNodesList).toHaveBeenCalledTimes(1);
		expect(mockRemoveNodes).toHaveBeenCalledTimes(1);
		expect(mockRemoveNodes).toHaveBeenCalledWith(
			expect.anything(), // first argument is the current state
			expect.arrayContaining(["node1", "node2"]),
		);
		expect(updatedState.size).toBe(1);
		expect(updatedState.get("node0")).toBeDefined();
	});
	it("should not ask itself for the list of nodes", async () => {
		const context = {
			nodeId: "node1",
			host: "localhost",
			port: 8080,
			getCurrentNodeState: () => createNodeState([node0]),
			updateNodeState: mock(),
		};
		mockSendJoinRequest.mockImplementation(() => {});
		const updatedState = await discoverOtherNodes(context);
		// node0, node2, node3
		expect(mockSendJoinRequest).toHaveBeenCalledTimes(3);
		expect(mockSendGetNodesList).toHaveBeenCalledTimes(3);
		expect(updatedState.size).toBe(3);
		expect(updatedState.get("node0")).toBeDefined();
		expect(updatedState.get("node1")).toBeUndefined();
		expect(updatedState.get("node2")).toBeDefined();
		expect(updatedState.get("node3")).toBeDefined();
	});
});
