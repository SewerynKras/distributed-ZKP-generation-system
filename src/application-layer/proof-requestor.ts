import * as snarkjs from "snarkjs";
import type { Groth16Proof } from "snarkjs";
import {
	Transaction,
	ProofRequest,
	type ProofResponse,
} from "../generated/grpc/proof_pb";
import type { KnownNode } from "../types";

export type ProofInput = {
	startingBalance: string[];
	transactions: [string, string, string][];
};

/**
 * Make sure that the given JSON file content contains valid input for the proof requestor.
 */
export function parseInputFile(fileContent: unknown): ProofInput {
	if (typeof fileContent !== "object" || fileContent === null) {
		throw new Error("Invalid input file, make sure it's a valid JSON object");
	}
	if (!("startingBalance" in fileContent) || !("transactions" in fileContent)) {
		throw new Error(
			"Invalid input file, make sure it contains both startingBalance and transactions properties",
		);
	}
	const startingBalance = fileContent.startingBalance;
	if (
		!Array.isArray(startingBalance) ||
		!startingBalance.every((balance) => typeof balance === "string")
	) {
		throw new Error(
			"Invalid input file, make sure the startingBalance property is an array",
		);
	}
	const transactions = fileContent.transactions;
	if (
		!Array.isArray(transactions) ||
		!transactions.every(
			(transaction) =>
				Array.isArray(transaction) &&
				transaction.length === 3 &&
				transaction.every((value) => typeof value === "string"),
		)
	) {
		throw new Error(
			"Invalid input file, make sure the transactions property is an array of arrays",
		);
	}
	return {
		startingBalance,
		transactions,
	};
}

export function mapInputToGrpcRequest(input: ProofInput): ProofRequest {
	const request = new ProofRequest();
	request.setStartingbalanceList(input.startingBalance);
	request.setTransactionsList(
		input.transactions.map(([sender, receiver, amount]) => {
			const transaction = new Transaction();
			transaction.setSender(sender);
			transaction.setReceiver(receiver);
			transaction.setAmount(amount);
			return transaction;
		}),
	);
	return request;
}

export async function sendProofRequest(
	node: KnownNode,
	input: ProofInput,
): Promise<ProofResponse> {
	const request = mapInputToGrpcRequest(input);
	const { promise, resolve, reject } = Promise.withResolvers<ProofResponse>();
	node.proofClient.generateProof(request, (err, response) => {
		if (err) {
			reject(err);
			return;
		}
		resolve(response);
	});
	return promise;
}

export function mapGrpcResponseToGroth16Proof(
	response: ProofResponse,
): Groth16Proof {
	const piA = response.getPiA();
	const piBList = response.getPiBList();
	const piC = response.getPiC();

	if (!piA || piBList.length === 0 || !piC) {
		throw new Error("Invalid proof response, make sure all fields are set");
	}
	const parsedPiA = [piA.getX(), piA.getY(), piA.getZ()];
	const parsedPiB = piBList.map((piB) => {
		const c0 = [piB.getC0(), piB.getC1()];
		return c0;
	});
	const parsedPiC = [piC.getX(), piC.getY(), piC.getZ()];

	return {
		pi_a: parsedPiA,
		pi_b: parsedPiB,
		pi_c: parsedPiC,
		protocol: response.getProtocol(),
		curve: response.getCurve(),
	};
}

/**
 * Verify that the given public signals belong to the given inputs.
 */
export function verifyPublicSignals(
	publicSignals: string[],
	initialBalance: string[],
	transactions: [string, string, string][],
): boolean {
	const expectedLength = initialBalance.length * 2 + transactions.length * 3;
	if (publicSignals.length !== expectedLength) {
		throw new Error(
			`Invalid public signals, expected ${expectedLength} elements, got ${publicSignals.length}`,
		);
	}
	// public signals are in the form of [finalBalance, initialBalance, transactions] flattened
	const balancesToVerify = publicSignals.slice(
		initialBalance.length,
		initialBalance.length * 2,
	);
	const transactionsToVerify = publicSignals.slice(initialBalance.length * 2);
	const transactionsFlattened = transactions.flat();
	return (
		balancesToVerify.every(
			(balance, index) => balance === initialBalance[index],
		) &&
		transactionsToVerify.every(
			(transaction, index) => transaction === transactionsFlattened[index],
		)
	);
}

export function verifyProof(
	proof: Groth16Proof,
	publicSignals: string[],
	verificationKey: string,
): Promise<boolean> {
	return snarkjs.groth16.verify(verificationKey, publicSignals, proof);
}
