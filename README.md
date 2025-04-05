# Distributed ZKP Generation System

Make sure you have [Bun](https://bun.sh) installed.

## Installation

```
bun install
```

## Compiling circuits

Use the `scripts/compile.sh` script to compile the circuits. This will generate the necessary files in the `zkp-artifacts` directory.

## Generating proofs

Use the `scripts/prove.sh` script to generate a proof for a given input file. You can use the `test/example_input.json` file as an example. It contains 100 random transactions between 10 accounts. The `proof.json` and `public.json` files will be generated in the `zkp-artifacts` directory.

## Verifying proofs

Use the `scripts/verify.sh` script to verify the proof that's generated in the `zkp-artifacts` directory.

## Reasoning for patching

At the time of writing (2025-04-05, Bun 1.2.8), the node.js implementation of the `web-worker` package is not compatible with Bun, because it ships it's own Worker global object. This causes a segmentation fault when creating proofs using multiple threads. The workaround is to force Bun to use the global Worker object instead of the custom node.js implementation, by adding an extra export to the `package.json` file.