#!/bin/bash

start_time=$(date +%s%N)
echo "Starting verification..."
snarkjs groth16 verify zkp-artifacts/verification_key.json zkp-artifacts/public.json zkp-artifacts/proof.json
verification_result=$?

end_time=$(date +%s%N)
elapsed_time=$(( (end_time - start_time)/1000000 ))
echo "Verification completed in $elapsed_time ms"

if [ $verification_result -ne 0 ]; then
    exit 1
fi