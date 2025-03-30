#!/bin/bash

set -e

start_time=$(date +%s%N)

input_file=$1
if [ -z "$input_file" ]; then
    echo "Usage: $0 <input_file>"
    exit 1
fi

cd zkp-artifacts/Rollup_cpp
echo "Generating witness..."
./Rollup ../../$input_file witness.wtns
cd ..

echo "Generating proof..."
snarkjs groth16 prove Rollup_0001.zkey ./Rollup_cpp/witness.wtns proof.json public.json

end_time=$(date +%s%N)
elapsed_time=$(( (end_time - start_time)/1000000 ))

echo "Generated ./zkp-artifacts/proof.json in $elapsed_time ms"