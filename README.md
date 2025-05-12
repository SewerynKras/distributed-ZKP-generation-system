# Distributed ZKP Generation System

Make sure you have [Bun](https://bun.sh) installed.

## Installation

```
bun install
```

## Running a node

Required environment variables:

- `CIRCUIT_PATH`: Path to the circuit file.
- `PROVING_KEY_PATH`: Path to the proving key file.
- `PORT`: Port to run the node on (default: 50051).
- `NODE_ID`: Node ID (default: default-node-id).
- `HOST`: Host to run the node on (default: ip of the current machine).
- `KNOWN_NODES_PATH`: Path to the JSON file with initial known nodes (optional).

Run the node with `bun run src/node.ts`.

### Simulating malicious nodes

To test the system's resilience against malicious nodes, you can configure a node to act as a malicious actor, which will respond with incorrect proofs. This is done by setting the `SIMULATE_MALICIOUS_NODE` environment variable.

```sh
export SIMULATE_MALICIOUS_NODE=1
bun run src/node.ts
```

## Running a client

Run the client with `bun run src/client.ts`. To generate and validate a proof, use the `prove` command:

```sh
bun run src/client.ts prove \
  --verification-key <verification-key-file> \
  --known-nodes <known-nodes-file> \
  --input-file <input-file-1> \
  --input-file <input-file-2> \
  --output-file <output-file-1> \
  --output-file <output-file-2>
```

If you're evaluating the performance of the system, you can use the `--metrics-file` option to save the metrics to a file. The metrics will be saved in Newline Delimited JSON format.

```sh
bun run src/client.ts prove \
  --verification-key <verification-key-file> \
  --known-nodes <known-nodes-file> \
  --input-file <input-file-1> \
  --output-file <output-file-1> \
  --metrics-file <metrics-file>
```

To simply scan the network for nodes, use the `scan` command:

```sh
bun run src/client.ts scan --known-nodes <known-nodes-file>
```

Use the `--help` flag to see all available options.

## Compiling circuits

Use the `scripts/compile.sh` script to compile the circuits. This will generate the necessary files in the `zkp-artifacts` directory.

## Generating proofs

Use the `scripts/prove.sh` script to generate a proof for a given input file. You can use the `test/example_input.json` file as an example. It contains 100 random transactions between 10 accounts. The `proof.json` and `public.json` files will be generated in the `zkp-artifacts` directory.

## Verifying proofs

Use the `scripts/verify.sh` script to verify the proof that's generated in the `zkp-artifacts` directory.

## Reasoning for patching

At the time of writing (2025-04-05, Bun 1.2.8), the node.js implementation of the `web-worker` package is not compatible with Bun, because it ships it's own Worker global object. This causes a segmentation fault when creating proofs using multiple threads. The workaround is to force Bun to use the global Worker object instead of the custom node.js implementation, by adding an extra export to the `package.json` file.