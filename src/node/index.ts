import  {  ComputeNodeService } from "../generated/grpc/contract_grpc_pb.js"; 
import { type PingMessage, PongMessage } from "../generated/grpc/contract_pb.js";
import * as grpc from "@grpc/grpc-js";

function ping(request: grpc.ServerUnaryCall<PingMessage, PongMessage>, callback: grpc.sendUnaryData<PongMessage>): void {
    console.log("Received ping request from node", request.request.getNodeId());
    const nodeId = "TEST_NODE";
    const timestamp = Date.now();
    const response = new PongMessage();
    response.setNodeId(nodeId);
    response.setTimestamp(timestamp);
    callback(null, response);
}

const server = new grpc.Server();
server.addService(ComputeNodeService, {
	ping,
});
server.bindAsync("0.0.0.0:50051", grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
        console.error(`Error starting server: ${err.message}`);
        return;
    }
    console.log(`Server started on port ${port}`);
});