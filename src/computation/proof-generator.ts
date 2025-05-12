import * as snarkjs from "snarkjs";

type Transaction = {
	sender: string;
	receiver: string;
	amount: string;
};

const CIRCUIT_PATH = Bun.env.CIRCUIT_PATH;
const PROVING_KEY_PATH = Bun.env.PROVING_KEY_PATH;

if (!CIRCUIT_PATH) {
	throw new Error("CIRCUIT_PATH environment variable not set");
}
if (!PROVING_KEY_PATH) {
	throw new Error("PROVING_KEY_PATH environment variable not set");
}

const circuit = await Bun.file(CIRCUIT_PATH)
	.arrayBuffer()
	.then((res) => new Uint8Array(res));
const provingKey = await Bun.file(PROVING_KEY_PATH)
	.arrayBuffer()
	.then((res) => new Uint8Array(res));

function transactionToPublicInput(transaction: Transaction) {
	return [transaction.sender, transaction.receiver, transaction.amount];
}

let generateProof: (
	startingBalance: string[],
	transactions: Transaction[],
) => Promise<{
	proof: snarkjs.Groth16Proof;
	publicSignals: string[];
}>;

if (Bun.env.SIMULATE_MALICIOUS_NODE) {
	console.warn(
		"⚠️ WARNING: Running a malicious node simulation. This is node will generate fake proofs.",
	);
	// For testing purposes, simulate a malicious node that generates a proof for different inputs
	generateProof = (startingBalance: string[], transactions: Transaction[]) => {
		const fakeBalances = startingBalance.map(() =>
			Math.floor(Math.random() * 1000 + 5000).toString(),
		);
		const fakeTransactions = transactions.map((transaction) => ({
			sender: transaction.sender,
			receiver: transaction.receiver,
			amount: Math.floor(Math.random() * 10).toString(),
		}));
		return snarkjs.groth16.fullProve(
			{
				startingBalance: fakeBalances,
				transactions: fakeTransactions.map(transactionToPublicInput),
			},
			circuit,
			provingKey,
		);
	};
} else {
	// For production, generate a proof for the actual inputs
	// This is the default behavior
	generateProof = (startingBalance: string[], transactions: Transaction[]) => {
		return snarkjs.groth16.fullProve(
			{
				startingBalance: startingBalance,
				transactions: transactions.map(transactionToPublicInput),
			},
			circuit,
			provingKey,
		);
	};
}
export { generateProof };
