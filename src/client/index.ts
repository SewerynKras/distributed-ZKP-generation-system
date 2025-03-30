import { ComputeNodeClient } from "../generated/grpc/contract_grpc_pb";
import grpc from "@grpc/grpc-js";
import { PingMessage } from "../generated/grpc/contract_pb";

const client = new ComputeNodeClient("localhost:50051", grpc.credentials.createInsecure());

const pingMessage = new PingMessage();
pingMessage.setNodeId("TEST_CLIENT");

client.ping(
    pingMessage,
    (err, response) => {
        if (err) {
            console.error(`Error pinging node: ${err.message}`);
            return;
        }
        console.log(`Received response from node: ${response.getNodeId()}`);
    }
);