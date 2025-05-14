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
- `HOST`: Hostname that will be advertised to other nodes (default: ip of the machine).

Optional environment variables:
- `KNOWN_NODES_PATH`: Path to the JSON file with initial known nodes.
- `SIMULATE_MALICIOUS_NODE`: Set to 1 to simulate a malicious node.
- `BIND_ADDRESS`: Local address to bind the node to (default: `[::]`). 

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

### Convenience script

<!-- To help with running repeated simulations, a convenience script is provided. You can run it with the following command: -->
If you wish to generate many proofs at once, you can use the `scripts/run-many.sh` script to automate the process. This script will run the client with the `prove` command for each input file in the specified directory.

```sh
./scripts/run-many.sh inputs_dir outputs_dir known_nodes.json
```

This will task the network with generating proofs for all input files in the given inputs directory, and save the results in the given outputs directory. The known nodes file will be used to discover nodes in the network.
The script will also create a `metrics.json` file in the outputs directory, which contains the metrics for each proof generation task.
The `test_inputs/` directory contains 10 sample input files, which can be used for testing (1000 transactions among 10 accounts).

## Compiling circuits

Use the `scripts/compile.sh` script to compile the circuits. This will generate the necessary files in the `zkp-artifacts` directory.

## Generating proofs locally

Use the `scripts/prove.sh` script to generate a proof for a given input file. You can use the `test_inputs/input0.json` file as an example. It contains 1000 random transactions between 10 accounts. The `proof.json` and `public.json` files will be generated in the `zkp-artifacts` directory.

## Verifying proofs locally

Use the `scripts/verify.sh` script to verify the proof that's generated in the `zkp-artifacts` directory.

## Deploying a node to a remote server

Before deploying a node to a remote server, make sure to compile the application using the following command:

```sh
bun build --compile --minify --sourcemap src/node.ts  --outfile zkp-node
```

This will create a `zkp-node` single binary executable in the current directory. 

Make sure to copy the `zkp-node` executable and the relevant circuit and proving key files to the remote server. You can use `scp` or any other file transfer method to copy the files.

```sh
scp zkp-node user@remote-server:/app/zkp-node
# Copy the circuit and proving key files
scp zkp-artifacts/Rollup_js/Rollup.wasm user@remote-server:/app/circuit.wasm
scp zkp-artifacts/Rollup_0001.zkey user@remote-server:/app/proving.key
# Copy the known nodes file if you have one
scp known_nodes.json user@remote-server:/app/known_nodes.json
# Save the node id to a file
ssh user@remote-server "echo 'remote-node-id' > /app/node_id.txt"
```

Once the files are copied, SSH into the remote server and run the node using the following command:

```sh
CIRCUIT_PATH="/app/circuit.wasm" \
PROVING_KEY_PATH="/app/proving.key" \
NODE_ID="$(cat /app/node_id.txt)" \
KNOWN_NODES_PATH="/app/known_nodes.json" \
./zkp-node
```

## Reasoning for patching

At the time of writing (2025-04-05, Bun 1.2.8), the node.js implementation of the `web-worker` package is not compatible with Bun, because it ships it's own Worker global object. This causes a segmentation fault when creating proofs using multiple threads. The workaround is to force Bun to use the global Worker object instead of the custom node.js implementation, by adding an extra export to the `package.json` file.
