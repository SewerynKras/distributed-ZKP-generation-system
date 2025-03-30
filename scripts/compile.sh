#!/bin/bash

set -e

if [ ! -d "zkp-artifacts" ]; then
	mkdir zkp-artifacts
fi

circom circuits/Rollup.circom --r1cs --wasm --sym --c --output zkp-artifacts -l node_modules/circomlib/circuits
cd zkp-artifacts/Rollup_cpp
make
cd ..
if [ ! -f powersOfTau28_hez_final_19.ptau ]; then
    echo "powersOfTau28_hez_final_19.ptau not found, downloading..."
	wget https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_19.ptau
    checksum=bca9d8b04242f175189872c42ceaa21e2951e0f0f272a0cc54fc37193ff6648600eaf1c555c70cdedfaf9fb74927de7aa1d33dc1e2a7f1a50619484989da0887
    if [ "$(b2sum powersOfTau28_hez_final_19.ptau | cut -d' ' -f1)" != "$checksum" ]; then
        echo "Error: checksum mismatch for powersOfTau28_hez_final_19.ptau"
        exit 1
    fi
    echo "powersOfTau28_hez_final_19.ptau downloaded successfully!"
fi 
snarkjs groth16 setup Rollup.r1cs powersOfTau28_hez_final_19.ptau Rollup_0000.zkey
openssl rand -hex 32 | snarkjs zkey contribute Rollup_0000.zkey  Rollup_0001.zkey
snarkjs zkey export verificationkey Rollup_0001.zkey verification_key.json