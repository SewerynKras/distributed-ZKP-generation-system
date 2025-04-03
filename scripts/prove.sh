#!/bin/bash

set -e

start_time=$(date +%s%N)

input_file=$1
if [ -z "$input_file" ]; then
    echo "Usage: $0 <input_file>"
    exit 1
fi

echo "Generating proof..."
snarkjs groth16 fullprove $input_file ./zkp-artifacts/Rollup_js/Rollup.wasm  ./zkp-artifacts/Rollup_0001.zkey  ./zkp-artifacts/proof.json ./zkp-artifacts/public.json

end_time=$(date +%s%N)
elapsed_time=$(( (end_time - start_time)/1000000 ))

echo "Generated ./zkp-artifacts/proof.json in $elapsed_time ms"