import { describe, it, expect, mock, afterEach, afterAll } from "bun:test";
import {
	addNode,
	addNodes,
	cleanupNodeResources,
	createInitialNodeState,
	createNode,
	createNodeState,
	getKnownNodes,
	parseInitialNodeState,
	removeNode,
	removeNodes,
} from "../src/network/node-manager";
import { mockModule } from "./utils";

const mockCreateNetworkClient = mock(() => ({
	ping: mock,
	joinNetwork: mock,
	getNodesList: mock,
	close: mock,
}));
const mockCreateProofClient = mock(() => ({
	close: mock,
}));

const mockDestroyClient = mock();
const clearMock = await mockModule(
	"../src/communication/grpc-client.ts",
	() => ({
		createNetworkClient: mockCreateNetworkClient,
		createProofClient: mockCreateProofClient,
		destroyClient: mockDestroyClient,
	}),
);

afterAll(() => {
	clearMock();
});

describe("node-manager", async () => {
	afterEach(() => {
		mockDestroyClient.mockClear();
		mockCreateNetworkClient.mockClear();
		mockCreateProofClient.mockClear();
	});

	describe("createNode", () => {
		it("should create a node", () => {
			const node = createNode("test-node", "localhost", 50051);
			expect(node.nodeId).toBe("test-node");
			expect(node.host).toBe("localhost");
			expect(node.port).toBe(50051);
			expect(node.missedPings).toBe(0);
			expect(node.networkClient).toBeDefined();
			expect(mockCreateNetworkClient).toHaveBeenCalledWith("localhost", 50051);
		});
	});
	describe("addNode", () => {
		it("should add a node to the state", () => {
			const node0 = createNode("test-node-0", "localhost", 50051);
			const node1 = createNode("test-node-1", "localhost", 50051);
			const state = createNodeState([node0, node1]);
			mockCreateNetworkClient.mockClear();
			mockCreateProofClient.mockClear();
			const newState = addNode(state, "test-node-2", "localhost", 50051);
			expect(newState.size).toBe(3);
			expect(newState.get("test-node-0")).toBe(node0);
			expect(newState.get("test-node-1")).toBe(node1);
			expect(newState.get("test-node-2")).toBeDefined();
			expect(mockCreateNetworkClient).toHaveBeenCalledWith("localhost", 50051);
			expect(mockCreateNetworkClient).toHaveBeenCalledTimes(1);
			expect(mockCreateProofClient).toHaveBeenCalledWith("localhost", 50051);
			expect(mockCreateProofClient).toHaveBeenCalledTimes(1);
		});
		it("should not add a node if it already exists", () => {
			const node0 = createNode("test-node-0", "localhost", 50051);
			const node1 = createNode("test-node-1", "localhost", 50051);
			const state = createNodeState([node0, node1]);
			mockCreateNetworkClient.mockClear();
			const newState = addNode(state, "test-node-1", "localhost", 50051);
			expect(newState.size).toBe(2);
			expect(newState.get("test-node-0")).toBe(node0);
			expect(newState.get("test-node-1")).toBe(node1);
			expect(mockCreateNetworkClient).toHaveBeenCalledTimes(0);
		});
	});
	describe("addNodes", () => {
		it("should add multiple nodes to the state", () => {
			const node0 = createNode("test-node-0", "localhost", 50051);
			const node1 = createNode("test-node-1", "localhost", 50051);
			const state = createNodeState([node0, node1]);
			mockCreateNetworkClient.mockClear();
			const newState = addNodes(state, [
				createNode("test-node-2", "localhost", 50051),
				createNode("test-node-3", "localhost", 50051),
			]);
			expect(newState.size).toBe(4);
			expect(newState.get("test-node-0")).toBe(node0);
			expect(newState.get("test-node-1")).toBe(node1);
			expect(newState.get("test-node-2")).toBeDefined();
			expect(newState.get("test-node-3")).toBeDefined();
			expect(mockCreateNetworkClient).toHaveBeenCalledTimes(2);
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
			expect(mockDestroyClient).toHaveBeenCalledWith(node1.networkClient);
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
			expect(mockDestroyClient).toHaveBeenCalledTimes(2);
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
			expect(node.networkClient).toBeDefined();
			cleanupNodeResources(node);
			expect(mockDestroyClient).toHaveBeenCalledWith(node.networkClient);
			expect(mockDestroyClient).toHaveBeenCalledWith(node.proofClient);
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
	describe("parseInitialNodeState", () => {
		it("should return true if the input is an array of objects with nodeId, host and port properties", () => {
			expect(
				parseInitialNodeState([
					{ nodeId: "node0", host: "localhost", port: 50051 },
					{ nodeId: "node1", host: "localhost", port: 50051 },
				]),
			).toBe(true);
		});
		it("should return false if the input is not an array", () => {
			expect(parseInitialNodeState(null)).toBe(false);
			expect(parseInitialNodeState(undefined)).toBe(false);
			expect(parseInitialNodeState({})).toBe(false);
			expect(parseInitialNodeState("test")).toBe(false);
			expect(parseInitialNodeState(123)).toBe(false);
			expect(parseInitialNodeState(true)).toBe(false);
			expect(parseInitialNodeState(false)).toBe(false);
		});
		it("should return false if any of the objects in the array does not have nodeId, host and port properties", () => {
			expect(
				parseInitialNodeState([
					{ nodeId: "node0", host: "localhost", port: 50051 },
					{ nodeId: "node1", host: "localhost", port: 50051 },
					{ nodeId: "node2", host: "localhost", port: 50051 },
					{ nodeiD: "node3", host: "localhost", port: 50051 },
				]),
			).toBe(false);
		});
	});
	describe("createInitialNodeState", () => {
		it("should create an empty node state if no nodes are provided", () => {
			const state = createInitialNodeState();
			expect(state.get().size).toBe(0);
			state.set(createNodeState([createNode("node0", "localhost", 50051)]));
			expect(state.get().size).toBe(1);
			expect(state.get().get("node0")).toBeDefined();
		});
		it("should create a node state from an array of nodes", () => {
			const state = createInitialNodeState([
				{ nodeId: "node0", host: "localhost", port: 50051 },
				{ nodeId: "node1", host: "localhost", port: 50051 },
			]);
			expect(state.get().size).toBe(2);
			expect(state.get().get("node0")).toBeDefined();
			expect(state.get().get("node1")).toBeDefined();
		});
		it("should throw an error if the input is not an array of objects with nodeId, host and port properties", () => {
			expect(() => createInitialNodeState("test")).toThrowError(
				"Invalid initial node state, make sure the file is a valid JSON array of objects with nodeId, host and port properties",
			);
		});
	});
});
