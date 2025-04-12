import { describe, it, expect, mock, afterEach } from "bun:test";
import type { ConsumerNodeContext, KnownNode } from "../src/types";
import { executeTasks } from "../src/application-layer/task-executor";
import type { NetworkClient } from "../src/generated/grpc/network_grpc_pb";
import type { ProofClient } from "../src/generated/grpc/proof_grpc_pb";

function getMockNode(nodeId: string): KnownNode {
	return {
		nodeId,
		host: "localhost",
		port: 8080,
		missedPings: 0,
		networkClient: {} as NetworkClient,
		proofClient: {} as ProofClient,
	};
}

const mockSendProofRequest = mock();

function getMockTask(result: string) {
	return mock(async (node: KnownNode) => {
		await new Promise((resolve) => setTimeout(resolve, 50));
		mockSendProofRequest(node, result);
		return result;
	});
}

describe("task-executor", () => {
	describe("executeTasks", () => {
		afterEach(() => {
			mockSendProofRequest.mockClear();
		});
		it("should execute all tasks in parallel", async () => {
			const node0 = getMockNode("node0");
			const node1 = getMockNode("node1");
			const node2 = getMockNode("node2");
			const context: ConsumerNodeContext = {
				getCurrentNodeState: () =>
					new Map([
						[node0.nodeId, node0],
						[node1.nodeId, node1],
						[node2.nodeId, node2],
					]),
				updateNodeState: mock(),
			};
			const task0 = getMockTask("task0");
			const task1 = getMockTask("task1");
			const task2 = getMockTask("task2");
			const tasks = [task0, task1, task2];
			const results = await executeTasks(tasks, context);
			expect(results).toEqual(["task0", "task1", "task2"]);
			expect(mockSendProofRequest).toHaveBeenCalledTimes(3);
			// we cannot predict which node will be used in combination with which task
			expect(mockSendProofRequest).toHaveBeenCalledWith(
				node0,
				expect.any(String),
			);
			expect(mockSendProofRequest).toHaveBeenCalledWith(
				node1,
				expect.any(String),
			);
			expect(mockSendProofRequest).toHaveBeenCalledWith(
				node2,
				expect.any(String),
			);
			expect(mockSendProofRequest).toHaveBeenCalledWith(
				expect.any(Object),
				"task0",
			);
			expect(mockSendProofRequest).toHaveBeenCalledWith(
				expect.any(Object),
				"task0",
			);
			expect(mockSendProofRequest).toHaveBeenCalledWith(
				expect.any(Object),
				"task1",
			);
			expect(mockSendProofRequest).toHaveBeenCalledWith(
				expect.any(Object),
				"task2",
			);
		});
		it("should reuse idle nodes if there are more tasks than idle nodes", async () => {
			const node0 = getMockNode("node0");
			const node1 = getMockNode("node1");
			const context: ConsumerNodeContext = {
				getCurrentNodeState: () =>
					new Map([
						[node0.nodeId, node0],
						[node1.nodeId, node1],
					]),
				updateNodeState: mock(),
			};
			const task0 = getMockTask("task0");
			const task1 = getMockTask("task1");
			const task2 = getMockTask("task2");
			const tasks = [task0, task1, task2];
			const results = await executeTasks(tasks, context);
			expect(results).toEqual(["task0", "task1", "task2"]);
			// we cannot predict which node will be used in combination with which task
			expect(mockSendProofRequest).toHaveBeenCalledTimes(3);
			expect(mockSendProofRequest).toHaveBeenCalledWith(
				node0,
				expect.any(String),
			);
			expect(mockSendProofRequest).toHaveBeenCalledWith(
				node1,
				expect.any(String),
			);
			const calledWithNode0 = mockSendProofRequest.mock.calls.filter(
				(call) => call[0] === node0,
			).length;
			const calledWithNode1 = mockSendProofRequest.mock.calls.filter(
				(call) => call[0] === node1,
			).length;
			expect(calledWithNode0 === 2 || calledWithNode1 === 2).toBe(true);
			expect(calledWithNode0 === 1 || calledWithNode1 === 1).toBe(true);
		});
		it("should retry failed tasks", async () => {
			const node0 = getMockNode("node0");
			const node1 = getMockNode("node1");
			const context: ConsumerNodeContext = {
				getCurrentNodeState: () =>
					new Map([
						[node0.nodeId, node0],
						[node1.nodeId, node1],
					]),
				updateNodeState: mock(),
			};
			const task0 = getMockTask("task0");
			const task1 = getMockTask("task1");
			const task2 = getMockTask("task2").mockImplementationOnce(
				async (node: KnownNode) => {
					await new Promise((resolve) => setTimeout(resolve, 50));
					mockSendProofRequest(node, "task2");
					throw new Error("Task 2 failed");
				},
			);
			const tasks = [task0, task1, task2];
			const results = await executeTasks(tasks, context);
			expect(results).toEqual(["task0", "task1", "task2"]);
			expect(mockSendProofRequest).toHaveBeenCalledTimes(4);
			// we cannot predict which node will be used in combination with which task
			expect(mockSendProofRequest).toHaveBeenCalledWith(
				node0,
				expect.any(String),
			);
			expect(mockSendProofRequest).toHaveBeenCalledWith(
				node1,
				expect.any(String),
			);
			expect(mockSendProofRequest).toHaveBeenCalledWith(
				expect.any(Object),
				"task0",
			);
			expect(mockSendProofRequest).toHaveBeenCalledWith(
				expect.any(Object),
				"task1",
			);
			// task2 should have been retried
			const callsWithTask2 = mockSendProofRequest.mock.calls.filter(
				(call) => call[1] === "task2",
			);
			expect(callsWithTask2.length).toBe(2);
		});
	});
});
