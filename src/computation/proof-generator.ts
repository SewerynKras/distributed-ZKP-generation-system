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

export function generateProof(
	startingBalance: string[],
	transactions: Transaction[],
) {
	return snarkjs.groth16.fullProve(
		{
			startingBalance: startingBalance,
			transactions: transactions.map(transactionToPublicInput),
		},
		circuit,
		provingKey,
		undefined,
		undefined,
		{ singleThread: true },
	);
}
