#!/bin/bash

input_directory=$1
output_directory=$2
known_nodes_file=$3
if [ -z "$input_directory" ] || [ -z "$output_directory" ] || [ -z "$known_nodes_file" ]; then
    echo "Usage: $0 <input_directory> <output_directory> <known_nodes_file>"
    exit 1
fi
mkdir -p "$output_directory"

command="bun run src/client.ts prove \
    --known-nodes $known_nodes_file \
    -k zkp-artifacts/verification_key.json \
    --metrics-file ${output_directory}/metrics-$(date +%Y-%m-%d-%H-%M-%S).ndjson \
    -t 60000"

for input_file in "$input_directory"/*; do
    base_name=$(basename "$input_file" .json)
    output_file="$output_directory/${base_name}.output.json"
    command+=" -i $input_file -o $output_file"
done

# Execute the constructed command
eval $command