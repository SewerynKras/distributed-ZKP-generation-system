import { parseInputFile } from "./application-layer/proof-requestor";
import { discoverOtherNodes } from "./network/node-discovery";
import {
	cleanupNodeResources,
	createInitialNodeState,
} from "./network/node-manager";
import type { ConsumerNodeContext } from "./types";
import { parseArgs } from "node:util";
import {
	createProofTask,
	executeTasks,
} from "./application-layer/task-executor";

const parsedArgs = parseArgs({
	args: Bun.argv,
	options: {
		"known-nodes": {
			type: "string",
			short: "n",
		},
		help: {
			type: "boolean",
			short: "h",
		},
		"input-file": {
			type: "string",
			short: "i",
			multiple: true,
		},
		"output-file": {
			type: "string",
			short: "o",
			multiple: true,
		},
		"verification-key": {
			type: "string",
			short: "k",
		},
		timeout: {
			type: "string",
			short: "t",
			default: "30000",
		},
	},
	strict: true,
	allowPositionals: true,
});

async function initNode(knownNodesPath: string) {
	const maybeInitiallyKnownNodes = await Bun.file(knownNodesPath).json();

	const nodeStateProxy = createInitialNodeState(maybeInitiallyKnownNodes);
	const nodeContext: ConsumerNodeContext = {
		getCurrentNodeState: nodeStateProxy.get.bind(nodeStateProxy),
		updateNodeState: nodeStateProxy.set.bind(nodeStateProxy),
	};

	console.log("Starting node discovery process, this may take a while...");
	const discoveredNodes = await discoverOtherNodes(nodeContext);
	nodeStateProxy.set(discoveredNodes);
	console.log(
		`Finished node discovery, found ${nodeContext.getCurrentNodeState().size} nodes`,
	);
	return nodeContext;
}

function cleanupNode(nodeContext: ConsumerNodeContext) {
	nodeContext.getCurrentNodeState().forEach(cleanupNodeResources);
}

function isActionValid(action: unknown): action is "scan" | "prove" {
	return action === "scan" || action === "prove";
}

type CliArgs = {
	"known-nodes"?: string;
	"input-file"?: string[];
	"output-file"?: string[];
	"verification-key"?: string;
	timeout: string;
	help?: boolean;
};

async function execute({
	values,
	positionals,
}: { values: CliArgs; positionals: string[] }) {
	const action = positionals.at(-1);
	if (values.help || !isActionValid(action)) {
		console.log(`Usage: bun run client.ts <scan|prove> [options]

Actions:
  scan   Discover nodes and list them.
  prove  Generate and verify a proof using the network.

Options:
  -n, --known-nodes <file>      Path to the JSON file with initial known nodes. (Required)
  -i, --input-file <file>       Path to the JSON input file for proof generation. (Required for prove, can be provided multiple times)
  -o, --output-file <file>      Path to the JSON file to write the resulting proof. (Required for prove, must be provided as many times as there are input files)
  -k, --verification-key <file> Path to the verification key JSON file. (Required for prove)
  -t, --timeout <ms>            Timeout for the proof generation process in milliseconds. (Default: 30000)
  -h, --help                    Show this help message.`);
		return;
	}
	if (!values["known-nodes"]) {
		throw new Error("No known nodes file provided. Use --known-nodes");
	}
	if (action === "scan") {
		const node = await initNode(values["known-nodes"]);
		console.table(
			[...node.getCurrentNodeState().values()].map((node) => ({
				nodeId: node.nodeId,
				host: node.host,
				port: node.port,
			})),
		);
		cleanupNode(node);
		process.exit(0);
	}
	if (
		!values["input-file"] ||
		!values["output-file"] ||
		!values["verification-key"] ||
		values["input-file"].length !== values["output-file"].length
	) {
		throw new Error(
			"Provide all required arguments. Use --input-file <path-to-file.json> --output-dir <path-to-directory> --verification-key <path-to-verification-key.json>",
		);
	}

	const parsedInputFiles = await Promise.all(
		values["input-file"].map((file) =>
			Bun.file(file).json().then(parseInputFile),
		),
	);
	const verificationKey = await Bun.file(values["verification-key"]).json();
	let timeoutAsInt = Number.parseInt(values.timeout);
	if (Number.isNaN(timeoutAsInt)) {
		console.warn("Invalid timeout value, using default value (30000ms)");
		timeoutAsInt = 30000;
	}
	// parse before connecting to the network to avoid unnecessary network requests if the input file is invalid
	const tasks = parsedInputFiles.map((inputFile, index) => {
		const outputFile = values["output-file"]?.[index];
		if (!outputFile) {
			throw new Error("Not enough output files provided");
		}
		return createProofTask(
			inputFile,
			outputFile,
			verificationKey,
			timeoutAsInt,
		);
	});
	// now it's safe to initialize the node context
	const nodeContext = await initNode(values["known-nodes"]);
	if (nodeContext.getCurrentNodeState().size === 0) {
		throw new Error(
			"No working nodes found, make sure the provided nodes are online and reachable",
		);
	}
	const results = await executeTasks(tasks, nodeContext);
	console.log("All tasks completed, writing results to output files...");
	for (const { proof, publicSignals, outputFile } of results) {
		await Bun.file(outputFile).write(JSON.stringify({ proof, publicSignals }));
	}

	cleanupNode(nodeContext);
	process.exit(0);
}

execute(parsedArgs);
