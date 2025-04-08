import { describe, it, expect, mock, afterEach, afterAll } from "bun:test";
import {
	addNode,
	addNodes,
	cleanupNodeResources,
	createNode,
	createNodeState,
	getKnownNodes,
	removeNode,
	removeNodes,
} from "../src/network/node-manager";
import { mockModule } from "./utils";

const mockCreateClient = mock(() => ({
	ping: mock,
	joinNetwork: mock,
	getNodesList: mock,
	close: mock,
}));

const mockDestroyClient = mock();
const clearMock = await mockModule(
	"../src/communication/grpc-client.ts",
	() => ({
		createClient: mockCreateClient,
		destroyClient: mockDestroyClient,
	}),
);

afterAll(() => {
	clearMock();
});

describe("node-manager", async () => {
	afterEach(() => {
		mockDestroyClient.mockClear();
		mockCreateClient.mockClear();
	});

	describe("createNode", () => {
		it("should create a node", () => {
			const node = createNode("test-node", "localhost", 50051);
			expect(node.nodeId).toBe("test-node");
			expect(node.host).toBe("localhost");
			expect(node.port).toBe(50051);
			expect(node.missedPings).toBe(0);
			expect(node.client).toBeDefined();
			expect(mockCreateClient).toHaveBeenCalledWith("localhost", 50051);
		});
	});
	describe("addNode", () => {
		it("should add a node to the state", () => {
			const node0 = createNode("test-node-0", "localhost", 50051);
			const node1 = createNode("test-node-1", "localhost", 50051);
			const state = createNodeState([node0, node1]);
			mockCreateClient.mockClear();
			const newState = addNode(state, "test-node-2", "localhost", 50051);
			expect(newState.size).toBe(3);
			expect(newState.get("test-node-0")).toBe(node0);
			expect(newState.get("test-node-1")).toBe(node1);
			expect(newState.get("test-node-2")).toBeDefined();
			expect(mockCreateClient).toHaveBeenCalledWith("localhost", 50051);
			expect(mockCreateClient).toHaveBeenCalledTimes(1);
		});
		it("should not add a node if it already exists", () => {
			const node0 = createNode("test-node-0", "localhost", 50051);
			const node1 = createNode("test-node-1", "localhost", 50051);
			const state = createNodeState([node0, node1]);
			mockCreateClient.mockClear();
			const newState = addNode(state, "test-node-1", "localhost", 50051);
			expect(newState.size).toBe(2);
			expect(newState.get("test-node-0")).toBe(node0);
			expect(newState.get("test-node-1")).toBe(node1);
			expect(mockCreateClient).toHaveBeenCalledTimes(0);
		});
	});
	describe("addNodes", () => {
		it("should add multiple nodes to the state", () => {
			const node0 = createNode("test-node-0", "localhost", 50051);
			const node1 = createNode("test-node-1", "localhost", 50051);
			const state = createNodeState([node0, node1]);
			mockCreateClient.mockClear();
			const newState = addNodes(state, [
				createNode("test-node-2", "localhost", 50051),
				createNode("test-node-3", "localhost", 50051),
			]);
			expect(newState.size).toBe(4);
			expect(newState.get("test-node-0")).toBe(node0);
			expect(newState.get("test-node-1")).toBe(node1);
			expect(newState.get("test-node-2")).toBeDefined();
			expect(newState.get("test-node-3")).toBeDefined();
			expect(mockCreateClient).toHaveBeenCalledTimes(2);
		});

		it("should only add unique nodes to the state", () => {
			const node0 = createNode("test-node-0", "localhost", 50051);
			const node1 = createNode("test-node-1", "localhost", 50051);
			const state = createNodeState([node0, node1]);
			const newState = addNodes(state, [
				node0,
				createNode("test-node-2", "localhost", 50051),
			]);
			expect(newState.size).toBe(3);
			expect(newState.get("test-node-0")).toBe(node0);
			expect(newState.get("test-node-1")).toBe(node1);
			expect(newState.get("test-node-2")).toBeDefined();
		});
	});
	describe("removeNode", () => {
		it("should remove a node from the state", () => {
			const node0 = createNode("test-node-0", "localhost", 50051);
			const node1 = createNode("test-node-1", "localhost", 50051);
			const state = createNodeState([node0, node1]);
			const newState = removeNode(state, "test-node-1");
			expect(newState.size).toBe(1);
			expect(newState.get("test-node-0")).toBe(node0);
			expect(mockDestroyClient).toHaveBeenCalledWith(node1.client);
		});
		it("should do nothing if the node is not in the state", () => {
			const node0 = createNode("test-node-0", "localhost", 50051);
			const node1 = createNode("test-node-1", "localhost", 50051);
			const state = createNodeState([node0, node1]);
			const newState = removeNode(state, "test-node-2");
			expect(newState.size).toBe(2);
			expect(newState.get("test-node-0")).toBe(node0);
			expect(newState.get("test-node-1")).toBe(node1);
			expect(mockDestroyClient).toHaveBeenCalledTimes(0);
		});
	});
	describe("removeNodes", () => {
		it("should remove nodes from the state", () => {
			const node0 = createNode("test-node-0", "localhost", 50051);
			const node1 = createNode("test-node-1", "localhost", 50051);
			const state = createNodeState([node0, node1]);
			const newState = removeNodes(state, ["test-node-1"]);
			expect(newState.size).toBe(1);
			expect(newState.get("test-node-0")).toBe(node0);
			expect(mockDestroyClient).toHaveBeenCalledTimes(1);
		});
		it("should do nothing if the node is not in the state", () => {
			const node0 = createNode("test-node-0", "localhost", 50051);
			const node1 = createNode("test-node-1", "localhost", 50051);
			const state = createNodeState([node0, node1]);
			const newState = removeNodes(state, ["test-node-2"]);
			expect(newState.size).toBe(2);
			expect(newState.get("test-node-0")).toBe(node0);
			expect(newState.get("test-node-1")).toBe(node1);
			expect(mockDestroyClient).toHaveBeenCalledTimes(0);
		});
	});

	describe("cleanupNodeResources", () => {
		it("should cleanup the node resources", () => {
			const node = createNode("test-node", "localhost", 50051);
			expect(node.client).toBeDefined();
			cleanupNodeResources(node);
			expect(mockDestroyClient).toHaveBeenCalledWith(node.client);
		});
	});
	describe("getKnownNodes", () => {
		it("should return an array of known nodes", () => {
			const node0 = createNode("test-node-0", "localhost", 50051);
			const node1 = createNode("test-node-1", "localhost", 50051);
			const state = createNodeState([node0, node1]);
			const nodes = getKnownNodes(state);
			expect(nodes.length).toBe(2);
			// order is not guaranteed
			expect(nodes).toEqual(expect.arrayContaining([node0, node1]));
		});
	});
	describe("createNodeState", () => {
		it("should create a node state from an array of nodes", () => {
			const node0 = createNode("test-node-0", "localhost", 50051);
			const node1 = createNode("test-node-1", "localhost", 50051);
			const state = createNodeState([node0, node1]);
			expect(state.size).toBe(2);
			expect(state.get("test-node-0")).toBe(node0);
			expect(state.get("test-node-1")).toBe(node1);
		});
		it("should create an empty node state if no nodes are provided", () => {
			const state = createNodeState();
			expect(state.size).toBe(0);
		});
	});
});
