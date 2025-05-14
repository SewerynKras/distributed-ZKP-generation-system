import { describe, it, expect, mock } from "bun:test";
import {
	mapGrpcResponseToGroth16Proof,
	mapInputToGrpcRequest,
	parseInputFile,
	sendProofRequest,
	verifyPublicSignals,
	type ProofInput,
} from "../src/application-layer/proof-requestor";
import type { NetworkClient } from "../src/generated/grpc/network_grpc_pb";
import type { ProofClient } from "../src/generated/grpc/proof_grpc_pb";
import {
	G1Point,
	Groth16PiBPair,
	ProofResponse,
} from "../src/generated/grpc/proof_pb";
import type * as grpc from "@grpc/grpc-js";

describe("proof-requestor", () => {
	describe("parseInputFile", () => {
		it("should return an object with startingBalance and transactions properties", () => {
			const inputFile = {
				startingBalance: ["1000", "2000", "3000"],
				transactions: [
					["0", "1", "1000"],
					["1", "2", "2000"],
					["2", "3", "3000"],
				],
			};
			const parsedInput = parseInputFile(inputFile);
			expect(parsedInput.startingBalance).toEqual(inputFile.startingBalance);
			expect(parsedInput.transactions).toEqual(
				inputFile.transactions as [string, string, string][],
			);
		});
		it("should throw an error if the input is not a valid JSON object", () => {
			expect(() => parseInputFile(null)).toThrowError(
				"Invalid input file, make sure it's a valid JSON object",
			);
			expect(() => parseInputFile(undefined)).toThrowError(
				"Invalid input file, make sure it's a valid JSON object",
			);
			expect(() => parseInputFile("test")).toThrowError(
				"Invalid input file, make sure it's a valid JSON object",
			);
			expect(() => parseInputFile(123)).toThrowError(
				"Invalid input file, make sure it's a valid JSON object",
			);
			expect(() => parseInputFile(true)).toThrowError(
				"Invalid input file, make sure it's a valid JSON object",
			);
			expect(() => parseInputFile(false)).toThrowError(
				"Invalid input file, make sure it's a valid JSON object",
			);
		});
		it("should throw an error if the input does not have the required properties", () => {
			const inputFile = {
				startingBalance: ["1000", "2000", "3000"],
				// no transactions property
			};
			expect(() => parseInputFile(inputFile)).toThrowError(
				"Invalid input file, make sure it contains both startingBalance and transactions properties",
			);
			const inputFile2 = {
				transactions: [
					["0", "1", "1000"],
					["1", "2", "2000"],
					["2", "3", "3000"],
				],
				// no startingBalance property
			};
			expect(() => parseInputFile(inputFile2)).toThrowError(
				"Invalid input file, make sure it contains both startingBalance and transactions properties",
			);
		});
	});
	describe("mapInputToGrpcRequest", () => {
		it("should return a ProofRequest object with the correct values", () => {
			const input: ProofInput = {
				startingBalance: ["1000", "2000", "3000"],
				transactions: [
					["0", "1", "1000"],
					["1", "2", "2000"],
					["2", "3", "3000"],
				],
			};
			const request = mapInputToGrpcRequest(input);
			expect(request.getStartingbalanceList()).toEqual(input.startingBalance);
			const txList = request.getTransactionsList();
			expect(txList.length).toBe(input.transactions.length);
			for (let i = 0; i < input.transactions.length; i++) {
				const tx = txList.at(i);
				const inputTx = input.transactions[i];
				if (!tx || !inputTx) {
					throw new Error("Transaction not found");
				}
				const [sender, receiver, amount] = inputTx;
				expect(tx.getSender()).toBe(sender);
				expect(tx.getReceiver()).toBe(receiver);
				expect(tx.getAmount()).toBe(amount);
			}
		});
	});
	describe("sendProofRequest", () => {
		it("should send a proof request to the given node", async () => {
			const node = {
				nodeId: "test-node",
				host: "localhost",
				port: 8080,
				missedPings: 0,
				networkClient: {} as NetworkClient,
				proofClient: {
					generateProof: mock(
						// cover all 3 overloads of the generateProof method
						(_request, metaOrCallback, optionsOrCallback?, maybeCallback?) => {
							if (typeof metaOrCallback === "function") {
								metaOrCallback(null, new ProofResponse());
							} else if (typeof optionsOrCallback === "function") {
								optionsOrCallback(null, new ProofResponse());
							} else if (maybeCallback) {
								maybeCallback(null, new ProofResponse());
							}
							return {} as grpc.ClientUnaryCall;
						},
					) as ProofClient["generateProof"],
				} as ProofClient,
			};
			const input: ProofInput = {
				startingBalance: ["1000", "2000", "3000"],
				transactions: [
					["0", "1", "1000"],
					["1", "2", "2000"],
					["2", "3", "3000"],
				],
			};
			const request = mapInputToGrpcRequest(input);
			await sendProofRequest(node, input);
			expect(node.proofClient.generateProof).toHaveBeenCalledWith(
				request,
				expect.any(Object), // metadata
				expect.any(Object), // options
				expect.any(Function),
			);
		});
	});
	describe("mapGrpcResponseToGroth16Proof", () => {
		// helpers
		function getValidPiA(): G1Point {
			const piA = new G1Point();
			piA.setX("1111");
			piA.setY("2222");
			piA.setZ("1");
			return piA;
		}
		function getValidPiB(): Groth16PiBPair[] {
			const pair0 = new Groth16PiBPair();
			pair0.setC0("3333");
			pair0.setC1("4444");
			const pair1 = new Groth16PiBPair();
			pair1.setC0("5555");
			pair1.setC1("6666");
			const pair2 = new Groth16PiBPair();
			pair2.setC0("1");
			pair2.setC1("0");
			return [pair0, pair1, pair2];
		}
		function getValidPiC(): G1Point {
			const piC = new G1Point();
			piC.setX("7777");
			piC.setY("8888");
			piC.setZ("1");
			return piC;
		}
		it("should return a Groth16Proof object with the correct values", () => {
			const response = new ProofResponse();
			response.setPiA(getValidPiA());
			response.setPiBList(getValidPiB());
			response.setPiC(getValidPiC());
			response.setProtocol("groth16");
			response.setCurve("bn128");
			const proof = mapGrpcResponseToGroth16Proof(response);
			expect(proof.pi_a).toEqual(["1111", "2222", "1"]);
			expect(proof.pi_b).toEqual([
				["3333", "4444"],
				["5555", "6666"],
				["1", "0"],
			]);
			expect(proof.pi_c).toEqual(["7777", "8888", "1"]);
			expect(proof.protocol).toBe("groth16");
			expect(proof.curve).toBe("bn128");
		});
		it("should throw an error if piA is invalid", () => {
			const response = new ProofResponse();
			// invalid piA
			response.setPiA(undefined);
			response.setPiBList(getValidPiB());
			response.setPiC(getValidPiC());
			expect(() => mapGrpcResponseToGroth16Proof(response)).toThrowError(
				"Invalid proof response, make sure all fields are set",
			);
		});
		it("should throw an error if piBList is invalid", () => {
			const response = new ProofResponse();
			response.setPiA(getValidPiA());
			// invalid piBList
			response.setPiBList([]);
			response.setPiC(getValidPiC());
			expect(() => mapGrpcResponseToGroth16Proof(response)).toThrowError(
				"Invalid proof response, make sure all fields are set",
			);
		});
		it("should throw an error if piC is invalid", () => {
			const response = new ProofResponse();
			response.setPiA(getValidPiA());
			response.setPiBList(getValidPiB());
			// invalid piC
			response.setPiC(undefined);
			expect(() => mapGrpcResponseToGroth16Proof(response)).toThrowError(
				"Invalid proof response, make sure all fields are set",
			);
		});
	});
	describe("verifyPublicSignals", () => {
		it("should return true if the public signals match the input", () => {
			/*
                3 accounts
                initially, all have 100 tokens
                tx0: account1 sends all their balance to account0
                tx1: account2 sends half of their balance to account0
                in the end, account0 should have 250 tokens, account1 should have 0 tokens, and account2 should have 50 tokens
            */
			const publicSignals = [
				"250",
				"0",
				"50",
				"100",
				"100",
				"100",
				"1",
				"0",
				"100",
				"2",
				"0",
				"50",
			];
			const initialBalance = ["100", "100", "100"];
			const transactions = [
				["1", "0", "100"],
				["2", "0", "50"],
			] as const satisfies [string, string, string][];
			expect(
				verifyPublicSignals(publicSignals, initialBalance, transactions),
			).toBe(true);
		});
		it("should return false if the initial balance is incorrect", () => {
			/*
                3 accounts
                initially, all have 100 tokens
                tx0: account1 sends all their balance to account0
                tx1: account2 sends half of their balance to account0
                in the end, account0 should have 250 tokens, account1 should have 0 tokens, and account2 should have 50 tokens
            */
			const publicSignals = [
				"250",
				"0",
				"50",
				"100",
				"100",
				"100",
				"1",
				"1",
				"100",
				"2",
				"2",
				"50",
			];
			const initialBalance = ["100", "100", "150"];
			const transactions = [
				["1", "0", "100"],
				["2", "0", "50"],
			] as [string, string, string][];
			expect(
				verifyPublicSignals(publicSignals, initialBalance, transactions),
			).toBe(false);
		});
		it("should return false if the transactions are incorrect", () => {
			/*
                3 accounts
                initially, all have 100 tokens
                tx0: account1 sends all their balance to account0
                tx1: account2 sends half of their balance to account0
                in the end, account0 should have 250 tokens, account1 should have 0 tokens, and account2 should have 50 tokens
            */
			const publicSignals = [
				"250",
				"0",
				"50",
				"100",
				"100",
				"150",
				"1",
				"0",
				"100",
				"2",
				"0",
				"50",
			];
			const initialBalance = ["100", "100", "100"];
			const transactions = [
				["0", "1", "100"],
				["1", "2", "500"],
			] as [string, string, string][];
			expect(
				verifyPublicSignals(publicSignals, initialBalance, transactions),
			).toBe(false);
		});
		it("should throw an error if the length of public signals is incorrect", () => {
			const publicSignals = [
				"250",
				"0",
				"50",
				"100",
				"100",
				"100",
				"1",
				"0",
				"100",
				"2",
				"0",
				"50",
			];
			const initialBalance = ["100", "100", "100"];
			const transactions = [
				["0", "1", "100"],
				["1", "2", "50"],
				["1", "2", "50"], // extra transaction that wasn't included in the public signals
			] as [string, string, string][];
			expect(() =>
				verifyPublicSignals(publicSignals, initialBalance, transactions),
			).toThrowError("Invalid public signals, expected 15 elements, got 12");
		});
	});
});
